import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["VIEW_RASTREIO_OPERACIONAL"]);
    if (guard.denied) return guard.denied;
    await ensureOperationalTrackingTables();
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "30", 10) || 30;
    const offset = (page - 1) * limit;

    const unit = String(searchParams.get("unit") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const dateFrom = String(searchParams.get("dateFrom") || "").trim();
    const dateTo = String(searchParams.get("dateTo") || "").trim();

    const pool = getPool();

    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        WHERE i.view = 'em_busca'
          AND ($1::text = '' OR c.entrega = $1::text)
          AND (
            $2::text = ''
            OR c.cte::text ILIKE '%' || $2::text || '%'
            OR c.serie::text ILIKE '%' || $2::text || '%'
            OR c.entrega ILIKE '%' || $2::text || '%'
            OR c.coleta ILIKE '%' || $2::text || '%'
            OR c.destinatario ILIKE '%' || $2::text || '%'
          )
          AND (
            $3::text = '' OR DATE(
              GREATEST(
                COALESCE((SELECT MAX(n.data) FROM pendencias.notes n WHERE n.cte = c.cte AND n.serie = c.serie), '1970-01-01'::timestamptz),
                COALESCE((SELECT MAX(e.event_time) FROM pendencias.operacional_tracking_events e WHERE e.cte = c.cte AND e.serie = c.serie), '1970-01-01'::timestamptz)
              )
            ) >= $3::date
          )
          AND (
            $4::text = '' OR DATE(
              GREATEST(
                COALESCE((SELECT MAX(n.data) FROM pendencias.notes n WHERE n.cte = c.cte AND n.serie = c.serie), '1970-01-01'::timestamptz),
                COALESCE((SELECT MAX(e.event_time) FROM pendencias.operacional_tracking_events e WHERE e.cte = c.cte AND e.serie = c.serie), '1970-01-01'::timestamptz)
              )
            ) <= $4::date
          )
      `,
      [unit || "", q || "", dateFrom || "", dateTo || ""]
    );
    const total = totalResult.rows?.[0]?.total || 0;

    const result = await pool.query(
      `
        WITH base AS (
          SELECT
            c.cte::text AS cte,
            c.serie::text AS serie,
            c.coleta::text AS coleta,
            c.entrega::text AS entrega,
            c.destinatario::text AS destinatario,
            c.frete_pago::text AS frete_pago,
            c.valor_cte::numeric AS valor_cte,
            c.status::text AS status_logistica,
            c.mdfe_numero::text AS mdfe_numero,
            i.status_calculado AS status_calculado,
            lnk.vehicle_id,
            lnk.plate,
            pos.lat AS last_lat,
            pos.lng AS last_lng,
            pos.position_at AS last_position_at,
            -- última atualização: notas, eventos, telemetria ou sync CT-e (Neon)
            GREATEST(
              COALESCE((SELECT MAX(n.data) FROM pendencias.notes n WHERE n.cte = c.cte AND n.serie = c.serie), '1970-01-01'::timestamptz),
              COALESCE((SELECT MAX(e.event_time) FROM pendencias.operacional_tracking_events e WHERE e.cte = c.cte AND e.serie = c.serie), '1970-01-01'::timestamptz),
              COALESCE(pos.position_at, '1970-01-01'::timestamptz),
              COALESCE(c.updated_at::timestamptz, '1970-01-01'::timestamptz)
            ) AS last_update_at
          FROM pendencias.cte_view_index i
          JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
          LEFT JOIN LATERAL (
            SELECT ll.vehicle_id, ll.plate
            FROM pendencias.operational_load_links ll
            WHERE ll.cte = c.cte AND ll.serie = c.serie AND ll.ends_at IS NULL
            ORDER BY ll.starts_at DESC
            LIMIT 1
          ) lnk ON true
          LEFT JOIN LATERAL (
            SELECT p.lat, p.lng, p.position_at
            FROM pendencias.operational_vehicle_position_latest p
            WHERE p.provider = 'LIFE'
              AND (
                (lnk.plate IS NOT NULL AND p.plate = lnk.plate)
                OR (lnk.vehicle_id IS NOT NULL AND p.vehicle_id = lnk.vehicle_id)
              )
            ORDER BY p.position_at DESC
            LIMIT 1
          ) pos ON true
          WHERE i.view = 'em_busca'
            AND ($1::text = '' OR c.entrega = $1::text)
            AND (
              $2::text = ''
              OR c.cte::text ILIKE '%' || $2::text || '%'
              OR c.serie::text ILIKE '%' || $2::text || '%'
              OR c.entrega ILIKE '%' || $2::text || '%'
              OR c.coleta ILIKE '%' || $2::text || '%'
              OR c.destinatario ILIKE '%' || $2::text || '%'
            )
            AND (
              $3::text = '' OR DATE(
                GREATEST(
                  COALESCE((SELECT MAX(n.data) FROM pendencias.notes n WHERE n.cte = c.cte AND n.serie = c.serie), '1970-01-01'::timestamptz),
                  COALESCE((SELECT MAX(e.event_time) FROM pendencias.operacional_tracking_events e WHERE e.cte = c.cte AND e.serie = c.serie), '1970-01-01'::timestamptz)
                )
              ) >= $3::date
            )
            AND (
              $4::text = '' OR DATE(
                GREATEST(
                  COALESCE((SELECT MAX(n.data) FROM pendencias.notes n WHERE n.cte = c.cte AND n.serie = c.serie), '1970-01-01'::timestamptz),
                  COALESCE((SELECT MAX(e.event_time) FROM pendencias.operacional_tracking_events e WHERE e.cte = c.cte AND e.serie = c.serie), '1970-01-01'::timestamptz)
                )
              ) <= $4::date
            )
        )
        SELECT *
        FROM base
        ORDER BY last_update_at DESC, cte ASC
        LIMIT $5 OFFSET $6
      `,
      [unit || "", q || "", dateFrom || "", dateTo || "", limit, offset]
    );

    const data = (result.rows || []).map((row: any) => ({
      CTE: row.cte,
      SERIE: row.serie,
      COLETA: row.coleta || "",
      ENTREGA: row.entrega || "",
      DESTINATARIO: row.destinatario || "",
      FRETE_PAGO: row.frete_pago || "",
      VALOR_CTE: row.valor_cte != null ? String(row.valor_cte) : "",
      STATUS_CALCULADO: row.status_calculado || "",
      STATUS_LOGISTICA: row.status_logistica ? String(row.status_logistica) : "",
      MDFE_NUMERO: row.mdfe_numero != null ? String(row.mdfe_numero) : "",
      LAST_UPDATE_AT: formatDateTime(row.last_update_at),
      VEHICLE_ID: row.vehicle_id || "",
      PLATE: row.plate || "",
      LAST_LAT: row.last_lat != null ? Number(row.last_lat) : null,
      LAST_LNG: row.last_lng != null ? Number(row.last_lng) : null,
      LAST_POSITION_AT: row.last_position_at ? formatDateTime(row.last_position_at) : "",
      MINUTES_SINCE_LAST_POSITION:
        row.last_position_at != null
          ? Math.max(0, Math.round((Date.now() - new Date(row.last_position_at).getTime()) / 60000))
          : null,
    }));

    return NextResponse.json({ data, total });
  } catch (error) {
    console.error("OperationalTracking items GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

