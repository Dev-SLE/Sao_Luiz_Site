import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
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
            i.status_calculado AS status_calculado,
            -- última atualização via notas ou eventos manuais
            GREATEST(
              COALESCE((SELECT MAX(n.data) FROM pendencias.notes n WHERE n.cte = c.cte AND n.serie = c.serie), '1970-01-01'::timestamptz),
              COALESCE((SELECT MAX(e.event_time) FROM pendencias.operacional_tracking_events e WHERE e.cte = c.cte AND e.serie = c.serie), '1970-01-01'::timestamptz)
            ) AS last_update_at
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
      LAST_UPDATE_AT: formatDateTime(row.last_update_at),
    }));

    return NextResponse.json({ data, total });
  } catch (error) {
    console.error("OperationalTracking items GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

