import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["VIEW_RASTREIO_OPERACIONAL", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    await ensureOperationalTrackingTables();

    const { searchParams } = new URL(req.url);
    const originKey = String(searchParams.get("origin_key") || "").trim().toUpperCase();
    const destKey = String(searchParams.get("dest_key") || "").trim().toUpperCase();
    const variantParam = searchParams.get("variant_id");

    if (!originKey || !destKey) {
      return NextResponse.json({ error: "Informe origin_key e dest_key" }, { status: 400 });
    }

    const pool = getPool();

    const variantsRes = await pool.query(
      `
        SELECT
          variant_id,
          trip_count,
          duration_p50_minutes,
          duration_p90_minutes,
          last_sample_days,
          computed_at,
          is_primary,
          top_plates_json
        FROM pendencias.operational_route_od_variant
        WHERE origin_key = $1 AND dest_key = $2
        ORDER BY is_primary DESC, trip_count DESC, variant_id ASC
      `,
      [originKey, destKey]
    );
    const variantRows = variantsRes.rows || [];

    let selectedVariantId: number | null = null;
    if (variantParam != null && variantParam.trim() !== "") {
      const v = Number(variantParam);
      if (Number.isFinite(v) && variantRows.some((r: any) => Number(r.variant_id) === v)) {
        selectedVariantId = v;
      }
    }
    if (selectedVariantId == null) {
      const primary = variantRows.find((r: any) => r.is_primary);
      const first = variantRows[0];
      if (primary != null) selectedVariantId = Number(primary.variant_id);
      else if (first != null) selectedVariantId = Number(first.variant_id);
    }

    const variants = variantRows.map((r: any) => ({
      variant_id: Number(r.variant_id),
      trip_count: Number(r.trip_count),
      duration_p50_minutes: Number(r.duration_p50_minutes),
      duration_p90_minutes: Number(r.duration_p90_minutes),
      last_sample_days: Number(r.last_sample_days),
      computed_at: r.computed_at ? formatDateTime(r.computed_at) : "",
      is_primary: Boolean(r.is_primary),
      top_plates: Array.isArray(r.top_plates_json) ? r.top_plates_json : [],
    }));

    const [polyRes, wpRes, oStop, dStop, legacyStats] = await Promise.all([
      selectedVariantId != null
        ? pool.query(
            `
              SELECT seq, lat, lng
              FROM pendencias.operational_route_od_polyline
              WHERE origin_key = $1 AND dest_key = $2 AND variant_id = $3
              ORDER BY seq ASC
            `,
            [originKey, destKey, selectedVariantId]
          )
        : Promise.resolve({ rows: [] as any[] }),
      selectedVariantId != null
        ? pool.query(
            `
              SELECT seq, kind, stop_key, label, lat, lng
              FROM pendencias.operational_route_od_waypoint
              WHERE origin_key = $1 AND dest_key = $2 AND variant_id = $3
              ORDER BY seq ASC
            `,
            [originKey, destKey, selectedVariantId]
          )
        : Promise.resolve({ rows: [] as any[] }),
      pool.query(`SELECT stop_key, label, lat, lng FROM pendencias.operational_stop_reference WHERE stop_key = $1`, [
        originKey,
      ]),
      pool.query(`SELECT stop_key, label, lat, lng FROM pendencias.operational_stop_reference WHERE stop_key = $1`, [
        destKey,
      ]),
      pool.query(
        `
          SELECT origin_key, dest_key, trip_count, duration_p50_minutes, duration_p90_minutes, last_sample_days, computed_at
          FROM pendencias.operational_route_od_stats
          WHERE origin_key = $1 AND dest_key = $2
        `,
        [originKey, destKey]
      ),
    ]);

    let polyline = (polyRes.rows || []).map((r: any) => ({
      seq: Number(r.seq),
      lat: Number(r.lat),
      lng: Number(r.lng),
    }));

    const waypoints = (wpRes.rows || []).map((r: any) => ({
      seq: Number(r.seq),
      kind: String(r.kind || ""),
      stop_key: r.stop_key ? String(r.stop_key) : null,
      label: r.label ? String(r.label) : "",
      lat: Number(r.lat),
      lng: Number(r.lng),
    }));

    let stats: any = null;
    if (selectedVariantId != null && variantRows.length) {
      const row = variantRows.find((r: any) => Number(r.variant_id) === selectedVariantId);
      if (row) {
        stats = {
          variant_id: selectedVariantId,
          trip_count: Number(row.trip_count),
          duration_p50_minutes: Number(row.duration_p50_minutes),
          duration_p90_minutes: Number(row.duration_p90_minutes),
          last_sample_days: Number(row.last_sample_days),
          computed_at: row.computed_at ? formatDateTime(row.computed_at) : "",
        };
      }
    }

    if (polyline.length < 2 && legacyStats.rows?.[0]) {
      const legacyPoly = await pool.query(
        `
          SELECT seq, lat, lng
          FROM pendencias.operational_route_od_polyline
          WHERE origin_key = $1 AND dest_key = $2 AND variant_id = 0
          ORDER BY seq ASC
        `,
        [originKey, destKey]
      );
      polyline = (legacyPoly.rows || []).map((r: any) => ({
        seq: Number(r.seq),
        lat: Number(r.lat),
        lng: Number(r.lng),
      }));
      const ls = legacyStats.rows[0];
      stats = {
        variant_id: selectedVariantId ?? 0,
        trip_count: Number(ls.trip_count),
        duration_p50_minutes: Number(ls.duration_p50_minutes),
        duration_p90_minutes: Number(ls.duration_p90_minutes),
        last_sample_days: Number(ls.last_sample_days),
        computed_at: ls.computed_at ? formatDateTime(ls.computed_at) : "",
      };
      if (selectedVariantId == null) selectedVariantId = 0;
    }

    return NextResponse.json({
      origin_key: originKey,
      dest_key: destKey,
      variant_id: selectedVariantId,
      variants,
      originStop: oStop.rows?.[0] || null,
      destStop: dStop.rows?.[0] || null,
      stats,
      polyline,
      waypoints,
    });
  } catch (error) {
    console.error("route_pattern GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
