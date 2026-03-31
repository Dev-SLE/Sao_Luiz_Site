import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateTime } from "../../../lib/server/datetime";
import { ensureOperationalAssignmentsTable } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

const NORMALIZED_STATUS_SQL = `
  TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
`;

export async function GET(req: Request) {
  try {
    try {
      await ensureOperationalAssignmentsTable();
    } catch (e) {
      console.warn("[ctes_view] ensureOperationalAssignmentsTable falhou, seguindo sem atribuições", e);
    }
    const { searchParams } = new URL(req.url);
    const view = (searchParams.get("view") || "pendencias").toLowerCase();
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    const viewKey = ["pendencias", "criticos", "em_busca", "tad", "concluidos"].includes(view) ? view : "pendencias";

    const pool = getPool();
    const assignmentReg = await pool.query(`SELECT to_regclass('pendencias.cte_assignments') AS reg`);
    const assignmentAvailable = !!assignmentReg.rows?.[0]?.reg;
    const assignmentSelect = assignmentAvailable
      ? `
          a.assignment_type,
          a.agency_unit,
          a.assigned_username,
          a.updated_at AS assignment_updated_at,
        `
      : `
          NULL::text AS assignment_type,
          NULL::text AS agency_unit,
          NULL::text AS assigned_username,
          NULL::timestamptz AS assignment_updated_at,
        `;
    const assignmentJoin = assignmentAvailable
      ? `
        LEFT JOIN pendencias.cte_assignments a
          ON a.cte = c.cte
          AND (a.serie = c.serie OR ltrim(a.serie, '0') = ltrim(c.serie, '0'))
          AND a.active = true
          AND a.assignment_type = 'PENDENTE_AG_BAIXAR'
      `
      : ``;

    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM pendencias.ctes c
        LEFT JOIN pendencias.cte_view_index i
          ON i.cte = c.cte
          AND (i.serie = c.serie OR ltrim(i.serie, '0') = ltrim(c.serie, '0'))
        WHERE
          (
            $1 = 'concluidos'
            AND (
              COALESCE(i.view, '') = 'concluidos'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CONCLUIDO%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'ENTREGUE%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'RESOLVIDO%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CANCELADO%'
            )
          )
          OR (
            $1 = 'criticos'
            AND (
              COALESCE(i.view, '') = 'criticos'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%'
            )
            AND ${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'ENTREGUE%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'RESOLVIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CANCELADO%'
          )
          OR (
            $1 <> 'concluidos'
            AND $1 <> 'criticos'
            AND (
              ($1 = 'pendencias' AND ${NORMALIZED_STATUS_SQL} IN ('FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHA', 'NO PRAZO'))
              OR ($1 <> 'pendencias' AND COALESCE(i.view, '') = $1)
            )
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'ENTREGUE%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'RESOLVIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CANCELADO%'
          )
      `,
      [viewKey]
    );
    const total = totalResult.rows?.[0]?.total || 0;

    const result = await pool.query(
      `
        SELECT
          c.*,
          CASE
            WHEN ${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%' THEN 'CRÍTICO'
            WHEN ${NORMALIZED_STATUS_SQL} LIKE 'FORA DO PRAZO%' THEN 'FORA DO PRAZO'
            WHEN ${NORMALIZED_STATUS_SQL} LIKE 'PRIORIDADE%' THEN 'PRIORIDADE'
            WHEN ${NORMALIZED_STATUS_SQL} LIKE 'VENCE AMANHA%' THEN 'VENCE AMANHÃ'
            WHEN ${NORMALIZED_STATUS_SQL} LIKE 'NO PRAZO%' THEN 'NO PRAZO'
            ELSE COALESCE(i.status_calculado, c.status)
          END AS status_calculado,
          COALESCE(i.note_count, 0) AS note_count,
          ${assignmentSelect}
          CASE
            WHEN COALESCE(i.view, '') = 'tad' THEN 'TAD'
            WHEN COALESCE(i.view, '') = 'em_busca' THEN 'EM BUSCA'
            ELSE c.status
          END AS status_exibicao
        FROM pendencias.ctes c
        LEFT JOIN pendencias.cte_view_index i
          ON i.cte = c.cte
          AND (i.serie = c.serie OR ltrim(i.serie, '0') = ltrim(c.serie, '0'))
        ${assignmentJoin}
        WHERE
          (
            $1 = 'concluidos'
            AND (
              COALESCE(i.view, '') = 'concluidos'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CONCLUIDO%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'ENTREGUE%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'RESOLVIDO%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CANCELADO%'
            )
          )
          OR (
            $1 = 'criticos'
            AND (
              COALESCE(i.view, '') = 'criticos'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%'
            )
            AND ${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'ENTREGUE%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'RESOLVIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CANCELADO%'
          )
          OR (
            $1 <> 'concluidos'
            AND $1 <> 'criticos'
            AND (
              ($1 = 'pendencias' AND ${NORMALIZED_STATUS_SQL} IN ('FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHA', 'NO PRAZO'))
              OR ($1 <> 'pendencias' AND COALESCE(i.view, '') = $1)
            )
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'ENTREGUE%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'RESOLVIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CANCELADO%'
          )
        ORDER BY c.data_emissao DESC
        LIMIT $2 OFFSET $3
      `,
      [viewKey, limit, offset]
    );

    const rows = (result.rows || []).map((row: any) => ({
      ...row,
      status: row.status_exibicao || row.status || "",
      data_emissao: formatDateTime(row.data_emissao),
      data_baixa: formatDateTime(row.data_baixa),
      data_limite_baixa: formatDateTime(row.data_limite_baixa),
    }));

    return NextResponse.json({ data: rows, total });
  } catch (error) {
    console.error("Erro ao buscar CTes por view:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

