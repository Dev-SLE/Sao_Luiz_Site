import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables, ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";
import { matchAgencyStopKey } from "../../../../lib/cteLocationKeys";
import { bearingFromTrail, computeRouteProgress } from "../../../../lib/server/routePatternProgress";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view", "VIEW_CRM_CHAT"]);
    if (guard.denied) return guard.denied;

    await Promise.all([ensureCrmSchemaTables(), ensureOperationalTrackingTables()]);
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const leadId = String(searchParams.get("leadId") || "").trim();
    const cteParam = String(searchParams.get("cte") || "").trim();
    const serieParam = String(searchParams.get("serie") || "").trim();
    const variantParamRaw = searchParams.get("variant_id");
    const variantParam =
      variantParamRaw != null && variantParamRaw.trim() !== "" && Number.isFinite(Number(variantParamRaw))
        ? Number(variantParamRaw)
        : null;

    let cte = cteParam;
    let serie = serieParam || "0";
    let leadMeta: any = null;

    if (leadId) {
      const leadRes = await pool.query(
        `
          SELECT id, cte_number, cte_serie, protocol_number, route_origin, route_destination, current_location, tracking_active
          FROM pendencias.crm_leads
          WHERE id = $1::uuid
          LIMIT 1
        `,
        [leadId]
      );
      leadMeta = leadRes.rows?.[0] || null;
      if (!leadMeta) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
      cte = cte || String(leadMeta.cte_number || "").trim();
      serie = serieParam || String(leadMeta.cte_serie || "0").trim() || "0";
    }

    if (!cte) {
      return NextResponse.json({
        lead: leadMeta,
        cte: null,
        serie: null,
        found: false,
        reason: "lead_sem_cte",
      });
    }

    const cteRes = await pool.query(
      `
        SELECT
          c.cte::text AS cte,
          c.serie::text AS serie,
          c.coleta::text AS coleta,
          c.entrega::text AS entrega,
          i.view::text AS idx_view,
          i.status_calculado::text AS status_calculado
        FROM pendencias.ctes c
        LEFT JOIN pendencias.cte_view_index i
          ON i.cte = c.cte AND i.serie = c.serie
        WHERE c.cte = $1
          AND (c.serie = $2 OR ltrim(c.serie, '0') = ltrim($2, '0'))
        ORDER BY (CASE WHEN i.view = 'em_busca' THEN 0 ELSE 1 END), c.updated_at DESC
        LIMIT 1
      `,
      [cte, serie]
    );
    const cteRow = cteRes.rows?.[0] || null;
    if (!cteRow) {
      return NextResponse.json({
        lead: leadMeta,
        cte,
        serie,
        found: false,
        reason: "cte_nao_encontrado",
      });
    }
    cte = String(cteRow.cte || cte).trim();
    serie = String(cteRow.serie || serie).trim() || "0";

    const [activeLinkRes, linksRes] = await Promise.all([
      pool.query(
        `
          SELECT id, cte, serie, mdf, vehicle_id, plate, starts_at, ends_at, source
          FROM pendencias.operational_load_links
          WHERE cte = $1
            AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
            AND ends_at IS NULL
          ORDER BY starts_at DESC
          LIMIT 1
        `,
        [cte, serie]
      ),
      pool.query(
        `
          SELECT id, cte, serie, mdf, vehicle_id, plate, starts_at, ends_at, source
          FROM pendencias.operational_load_links
          WHERE cte = $1
            AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
          ORDER BY starts_at DESC
          LIMIT 20
        `,
        [cte, serie]
      ),
    ]);

    const activeLink = activeLinkRes.rows?.[0] || null;
    const trailRes =
      activeLink != null
        ? await pool.query(
            `
              SELECT lat, lng, position_at, vehicle_id, plate, odometer_km
              FROM pendencias.operational_vehicle_positions p
              WHERE p.provider = 'LIFE'
                AND (
                  ($1::text IS NOT NULL AND p.plate = $1)
                  OR ($2::text IS NOT NULL AND p.vehicle_id = $2)
                )
              ORDER BY p.position_at DESC
              LIMIT 500
            `,
            [activeLink.plate || null, activeLink.vehicle_id || null]
          )
        : { rows: [] as any[] };

    const trail = (trailRes.rows || []).map((r: any) => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      at: formatDateTime(r.position_at),
      position_at: r.position_at,
      vehicle_id: r.vehicle_id || null,
      plate: r.plate || null,
      odometer_km: r.odometer_km != null ? Number(r.odometer_km) : null,
    }));

    const originKey = matchAgencyStopKey(cteRow.coleta);
    const destKey = matchAgencyStopKey(cteRow.entrega);

    let variants: any[] = [];
    let selectedVariantId: number | null = null;
    let stats: any = null;
    let polyline: Array<{ seq: number; lat: number; lng: number }> = [];
    let waypoints: Array<{ seq: number; kind: string; stop_key: string | null; label: string; lat: number; lng: number }> = [];
    let routeProgress: any = null;

    if (originKey && destKey) {
      const varsRes = await pool.query(
        `
          SELECT
            variant_id,
            trip_count,
            duration_p50_minutes,
            duration_p90_minutes,
            is_primary,
            computed_at,
            top_plates_json
          FROM pendencias.operational_route_od_variant
          WHERE origin_key = $1 AND dest_key = $2
          ORDER BY is_primary DESC, trip_count DESC, variant_id ASC
        `,
        [originKey, destKey]
      );
      variants = (varsRes.rows || []).map((v: any) => ({
        variant_id: Number(v.variant_id),
        trip_count: Number(v.trip_count),
        duration_p50_minutes: Number(v.duration_p50_minutes),
        duration_p90_minutes: Number(v.duration_p90_minutes),
        is_primary: Boolean(v.is_primary),
        computed_at: v.computed_at ? formatDateTime(v.computed_at) : "",
        top_plates: Array.isArray(v.top_plates_json) ? v.top_plates_json : [],
      }));
      if (variantParam != null && variants.some((v) => v.variant_id === variantParam)) {
        selectedVariantId = variantParam;
      } else {
        selectedVariantId = variants[0]?.variant_id ?? null;
      }

      if (selectedVariantId != null) {
        const [polyRes, wpRes] = await Promise.all([
          pool.query(
            `
              SELECT seq, lat, lng
              FROM pendencias.operational_route_od_polyline
              WHERE origin_key = $1 AND dest_key = $2 AND variant_id = $3
              ORDER BY seq ASC
            `,
            [originKey, destKey, selectedVariantId]
          ),
          pool.query(
            `
              SELECT seq, kind, stop_key, label, lat, lng
              FROM pendencias.operational_route_od_waypoint
              WHERE origin_key = $1 AND dest_key = $2 AND variant_id = $3
              ORDER BY seq ASC
            `,
            [originKey, destKey, selectedVariantId]
          ),
        ]);
        polyline = (polyRes.rows || []).map((r: any) => ({
          seq: Number(r.seq),
          lat: Number(r.lat),
          lng: Number(r.lng),
        }));
        waypoints = (wpRes.rows || []).map((r: any) => ({
          seq: Number(r.seq),
          kind: String(r.kind || ""),
          stop_key: r.stop_key ? String(r.stop_key) : null,
          label: String(r.label || r.stop_key || ""),
          lat: Number(r.lat),
          lng: Number(r.lng),
        }));
        const selectedV = variants.find((v) => v.variant_id === selectedVariantId) || null;
        if (selectedV) {
          stats = {
            variant_id: selectedV.variant_id,
            trip_count: selectedV.trip_count,
            duration_p50_minutes: selectedV.duration_p50_minutes,
            duration_p90_minutes: selectedV.duration_p90_minutes,
            computed_at: selectedV.computed_at,
          };
        }
      }
    }

    if (trail.length >= 1 && polyline.length >= 2) {
      const latest = { lat: trail[0].lat, lng: trail[0].lng };
      const d50 = stats?.duration_p50_minutes != null ? Number(stats.duration_p50_minutes) : null;
      const prog = computeRouteProgress(
        polyline.map((p) => ({ lat: p.lat, lng: p.lng })),
        latest,
        d50
      );
      if (prog) {
        routeProgress = {
          variant_id: selectedVariantId,
          fraction_along: prog.fractionAlong,
          nearest_seg_index: prog.nearestSegIndex,
          eta_minutes_p50: prog.etaMinutesP50,
          bearing_route_deg: prog.bearingDeg,
          bearing_trail_deg: bearingFromTrail(trail.slice(0, 16).map((t) => ({ lat: t.lat, lng: t.lng }))),
          cumulative_km: prog.cumulativeKm,
          total_km: prog.totalKm,
          projected_lat: prog.projected.lat,
          projected_lng: prog.projected.lng,
        };
      }
    }

    const tripLegsRes = await pool.query(
      `
        SELECT leg_index, starts_at, ends_at, load_link_id
        FROM pendencias.operational_route_trip_leg
        WHERE cte = $1
          AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
        ORDER BY leg_index ASC, starts_at ASC
      `,
      [cte, serie]
    );

    return NextResponse.json({
      found: true,
      cte,
      serie,
      lead: leadMeta
        ? {
            id: String(leadMeta.id),
            protocol_number: leadMeta.protocol_number ? String(leadMeta.protocol_number) : null,
            route_origin: leadMeta.route_origin ? String(leadMeta.route_origin) : null,
            route_destination: leadMeta.route_destination ? String(leadMeta.route_destination) : null,
            current_location: leadMeta.current_location ? String(leadMeta.current_location) : null,
            tracking_active: Boolean(leadMeta.tracking_active),
          }
        : null,
      operational: {
        status_calculado: cteRow.status_calculado ? String(cteRow.status_calculado) : null,
        idx_view: cteRow.idx_view ? String(cteRow.idx_view) : null,
        coleta: cteRow.coleta ? String(cteRow.coleta) : "",
        entrega: cteRow.entrega ? String(cteRow.entrega) : "",
        origin_key: originKey,
        dest_key: destKey,
      },
      activeLink: activeLink
        ? {
            id: String(activeLink.id),
            mdf: activeLink.mdf ? String(activeLink.mdf) : null,
            vehicle_id: activeLink.vehicle_id ? String(activeLink.vehicle_id) : null,
            plate: activeLink.plate ? String(activeLink.plate) : null,
            starts_at: activeLink.starts_at ? formatDateTime(activeLink.starts_at) : null,
            source: activeLink.source ? String(activeLink.source) : null,
          }
        : null,
      links: (linksRes.rows || []).map((l: any) => ({
        id: String(l.id),
        mdf: l.mdf ? String(l.mdf) : null,
        vehicle_id: l.vehicle_id ? String(l.vehicle_id) : null,
        plate: l.plate ? String(l.plate) : null,
        starts_at: l.starts_at ? formatDateTime(l.starts_at) : null,
        ends_at: l.ends_at ? formatDateTime(l.ends_at) : null,
        source: l.source ? String(l.source) : null,
      })),
      routePattern: {
        variant_id: selectedVariantId,
        variants,
        stats,
        polyline,
        waypoints,
      },
      routeProgress,
      trail,
      tripLegs: (tripLegsRes.rows || []).map((r: any) => ({
        leg_index: Number(r.leg_index),
        starts_at: r.starts_at ? formatDateTime(r.starts_at) : "",
        ends_at: r.ends_at ? formatDateTime(r.ends_at) : null,
        load_link_id: r.load_link_id ? String(r.load_link_id) : null,
      })),
    });
  } catch (error) {
    console.error("[crm.operational_snapshot] GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
