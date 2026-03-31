import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureOperationalAssignmentsTable } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

const NORMALIZED_STATUS_SQL = `
  TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
`;

export async function POST(req: Request) {
  try {
    await ensureOperationalAssignmentsTable();
    const body = await req.json().catch(() => ({}));
    const {
      view,
      unit,
      statusFilters,
      paymentFilters,
      noteFilter,
      filterTxEntrega,
      ignoreUnitFilter,
      userLinkedDestUnit,
      assignmentFilter,
      assignmentAgency,
      assignmentUser,
      assignmentMineOnly,
      currentUsername,
    } = body || {};

    const viewKey = ["pendencias", "criticos", "em_busca", "tad", "concluidos"].includes(String(view)) ? String(view) : "pendencias";
    const effectiveUnit = (ignoreUnitFilter ? "" : (unit || userLinkedDestUnit || "")).trim();
    const statusArr = Array.isArray(statusFilters) ? statusFilters.map(String) : [];
    const payArr = Array.isArray(paymentFilters) ? paymentFilters.map(String) : [];
    const note = String(noteFilter || "ALL");
    const tx = !!filterTxEntrega;
    const assignmentMode = String(assignmentFilter || "ALL").toUpperCase();
    const assignmentAgencyValue = String(assignmentAgency || "").trim();
    const assignmentUserValue = String(assignmentUser || "").trim();
    const assignmentMine = !!assignmentMineOnly;
    const assignmentMineUser = String(currentUsername || "").trim();

    const noteCond = (alias: string) => {
      if (note === "WITH") return `AND ${alias}.note_count > 0`;
      if (note === "WITHOUT") return `AND ${alias}.note_count = 0`;
      return "";
    };
    const txCond = (alias: string) =>
      tx ? `AND COALESCE(NULLIF(${alias}.tx_entrega::text, ''), '0')::numeric > 0` : "";

    const sql = `
      WITH base AS (
        SELECT
          c.*,
          i.status_calculado,
          i.note_count,
          a.assignment_type,
          a.agency_unit,
          a.assigned_username,
          a.updated_at AS assignment_updated_at,
          CASE WHEN $1 = 'concluidos' THEN c.status ELSE i.status_calculado END AS status_key
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        LEFT JOIN pendencias.cte_assignments a
          ON a.cte = c.cte
          AND (a.serie = c.serie OR ltrim(a.serie, '0') = ltrim(c.serie, '0'))
          AND a.active = true
          AND a.assignment_type = 'PENDENTE_AG_BAIXAR'
        WHERE (
          (
            $1 = 'concluidos'
            AND (
              i.view = 'concluidos'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CONCLUIDO%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'ENTREGUE%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'RESOLVIDO%'
            )
          )
          OR (
            $1 <> 'concluidos'
            AND i.view = $1
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'ENTREGUE%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'RESOLVIDO%'
          )
        )
          AND ($2::text IS NULL OR c.entrega = $2::text)
          AND (
            $5::text = 'ALL'
            OR ($5::text = 'WITH' AND a.id IS NOT NULL)
            OR ($5::text = 'WITHOUT' AND a.id IS NULL)
          )
          AND ($6::text IS NULL OR $6::text = '' OR a.agency_unit = $6::text)
          AND ($7::text IS NULL OR $7::text = '' OR a.assigned_username = $7::text)
          AND (NOT $8::boolean OR ($9::text <> '' AND a.assigned_username = $9::text))
      ),
      base_for_status AS (
        SELECT * FROM base b
        WHERE (COALESCE(array_length($3::text[], 1), 0) = 0 OR b.frete_pago = ANY($3::text[]))
          ${noteCond("b")}
          ${txCond("b")}
      ),
      base_for_payment AS (
        SELECT * FROM base b
        WHERE (COALESCE(array_length($4::text[], 1), 0) = 0 OR b.status_key = ANY($4::text[]))
          ${noteCond("b")}
          ${txCond("b")}
      ),
      base_for_note AS (
        SELECT * FROM base b
        WHERE (COALESCE(array_length($3::text[], 1), 0) = 0 OR b.frete_pago = ANY($3::text[]))
          AND (COALESCE(array_length($4::text[], 1), 0) = 0 OR b.status_key = ANY($4::text[]))
          ${txCond("b")}
      ),
      base_for_tx AS (
        SELECT * FROM base b
        WHERE (COALESCE(array_length($3::text[], 1), 0) = 0 OR b.frete_pago = ANY($3::text[]))
          AND (COALESCE(array_length($4::text[], 1), 0) = 0 OR b.status_key = ANY($4::text[]))
          ${noteCond("b")}
      )
      SELECT
        (SELECT COUNT(*)::int FROM base) AS total,
        (SELECT jsonb_object_agg(s, cnt) FROM (
          SELECT status_key as s, COUNT(*)::int as cnt
          FROM base_for_status
          GROUP BY status_key
        ) x) AS status_counts,
        (SELECT jsonb_object_agg(p, cnt) FROM (
          SELECT COALESCE(frete_pago, 'SEM_INFO') as p, COUNT(*)::int as cnt
          FROM base_for_payment
          GROUP BY COALESCE(frete_pago, 'SEM_INFO')
        ) y) AS payment_counts,
        (SELECT COUNT(*)::int FROM base_for_note WHERE note_count > 0) AS note_with,
        (SELECT COUNT(*)::int FROM base_for_note WHERE note_count = 0) AS note_without,
        (SELECT COUNT(*)::int FROM base_for_tx WHERE COALESCE(NULLIF(tx_entrega::text, ''), '0')::numeric > 0) AS tx_entrega,
        (SELECT jsonb_object_agg(k, cnt) FROM (
          SELECT COALESCE(agency_unit, 'SEM_ATRIBUICAO') AS k, COUNT(*)::int AS cnt
          FROM base
          GROUP BY COALESCE(agency_unit, 'SEM_ATRIBUICAO')
        ) z) AS assignment_agency_counts,
        (SELECT jsonb_object_agg(k, cnt) FROM (
          SELECT COALESCE(assigned_username, 'SEM_ATRIBUICAO') AS k, COUNT(*)::int AS cnt
          FROM base
          GROUP BY COALESCE(assigned_username, 'SEM_ATRIBUICAO')
        ) w) AS assignment_user_counts
    `;

    const pool = getPool();
    const result = await pool.query(sql, [
      viewKey,
      effectiveUnit || null,
      payArr,
      statusArr,
      assignmentMode,
      assignmentAgencyValue || null,
      assignmentUserValue || null,
      assignmentMine,
      assignmentMineUser,
    ]);
    const row = result.rows?.[0] || {};

    return NextResponse.json({
      total: row.total || 0,
      statusCounts: row.status_counts || {},
      paymentCounts: row.payment_counts || {},
      noteWith: row.note_with || 0,
      noteWithout: row.note_without || 0,
      txEntrega: row.tx_entrega || 0,
      assignmentAgencyCounts: row.assignment_agency_counts || {},
      assignmentUserCounts: row.assignment_user_counts || {},
    });
  } catch (error) {
    console.error("Erro ao calcular counts:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

