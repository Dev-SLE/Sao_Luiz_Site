import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateOnlyBr } from "../../../lib/server/datetime";
import { ensureOperationalAssignmentsTable } from "../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../lib/server/authorization";
import { isAdminSuperRole } from "../../../lib/adminSuperRoles";
import {
  OPERATIONAL_CTE_STATUS_NORM_SQL,
  operationalCteUnitScopeAndClause,
} from "../../../lib/server/operationalCteUnitScope";

export const runtime = "nodejs";

const NORMALIZED_STATUS_SQL = OPERATIONAL_CTE_STATUS_NORM_SQL;

/**
 * Dataset consolidado da Visão geral operacional:
 * - Mesmo escopo de unidade/atribuição da `ctes_view`
 * - Sem concluídos
 * - 1 linha por (cte, serie), com prioridade de fila
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    try {
      await ensureOperationalAssignmentsTable();
    } catch (e) {
      console.warn("[ctes_dashboard] ensureOperationalAssignmentsTable falhou, seguindo sem atribuições", e);
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "10000", 10) || 10000;
    const offset = (page - 1) * limit;

    const hasOperationalGlobal = can(session, "scope.operacional.all") || isAdminSuperRole(session.role, session.username);
    const linkedDestUnit = String(session.dest || "").trim();
    const linkedOriginUnit = String(session.origin || "").trim();
    const sessionUser = String(session.username || "").trim();

    const pool = getPool();
    const assignmentReg = await pool.query(`SELECT to_regclass('pendencias.cte_assignments') AS reg`);
    const assignmentAvailable = !!assignmentReg.rows?.[0]?.reg;
    const assignPoolNarrow = assignmentAvailable && !hasOperationalGlobal;

    const assignmentJoin = assignmentAvailable
      ? `
        LEFT JOIN LATERAL (
          SELECT
            aa.assignment_type,
            aa.agency_unit,
            aa.assigned_username,
            aa.updated_at
          FROM pendencias.cte_assignments aa
          WHERE aa.active = true
            AND aa.assignment_type = 'PENDENTE_AG_BAIXAR'
            AND aa.cte = c.cte
            AND (aa.serie = c.serie OR ltrim(aa.serie, '0') = ltrim(c.serie, '0'))
          ORDER BY aa.updated_at DESC, aa.id DESC
          LIMIT 1
        ) a ON true
      `
      : ``;

    const filterParams: unknown[] = [];
    let opScopeFilterSql = "";
    if (!hasOperationalGlobal && (linkedDestUnit || linkedOriginUnit)) {
      filterParams.push(linkedDestUnit || null, linkedOriginUnit || null);
      opScopeFilterSql = operationalCteUnitScopeAndClause(1, 2);
    }
    let assignFilterSql = "";
    if (assignPoolNarrow) {
      filterParams.push(sessionUser);
      assignFilterSql = ` AND (COALESCE(TRIM(a.assigned_username), '') = '' OR LOWER(TRIM(a.assigned_username)) = LOWER(TRIM($${filterParams.length}::text))) `;
    }

    const limitParam = filterParams.length + 1;
    const offsetParam = filterParams.length + 2;
    const dataParams = [...filterParams, limit, offset];

    const result = await pool.query(
      `
        WITH base_ranked AS (
          SELECT
            c.*,
            COALESCE(i.status_calculado, c.status) AS status_calculado,
            COALESCE(i.note_count, 0) AS note_count,
            CASE
              WHEN COALESCE(i.view, '') IN ('ocorrencias', 'tad') THEN 'OCORRÊNCIA'
              WHEN COALESCE(i.view, '') = 'em_busca' THEN 'EM BUSCA'
              ELSE c.status
            END AS status_exibicao,
            ROW_NUMBER() OVER (
              PARTITION BY c.cte, c.serie
              ORDER BY
                CASE
                  WHEN COALESCE(i.view, '') = 'criticos' OR ${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%' THEN 1
                  WHEN COALESCE(i.view, '') IN ('ocorrencias', 'tad') THEN 2
                  WHEN COALESCE(i.view, '') = 'em_busca' THEN 3
                  WHEN ${NORMALIZED_STATUS_SQL} IN ('FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHA', 'NO PRAZO') THEN 4
                  ELSE 5
                END,
                c.data_emissao DESC
            ) AS rn
          FROM pendencias.ctes c
          LEFT JOIN pendencias.cte_view_index i
            ON i.cte = c.cte
            AND (i.serie = c.serie OR ltrim(i.serie, '0') = ltrim(c.serie, '0'))
          ${assignmentJoin}
          WHERE
            (
              (${NORMALIZED_STATUS_SQL} IN ('FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHA', 'NO PRAZO'))
              OR (${NORMALIZED_STATUS_SQL} LIKE 'CRITICO%')
              OR (COALESCE(i.view, '') IN ('criticos', 'em_busca', 'ocorrencias', 'tad'))
            )
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'ENTREGUE%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'RESOLVIDO%'
            AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CANCELADO%'
            ${opScopeFilterSql}
            ${assignFilterSql}
        ),
        base AS (
          SELECT * FROM base_ranked WHERE rn = 1
        )
        SELECT
          (SELECT COUNT(*)::int FROM base) AS total,
          COALESCE(
            (
              SELECT json_agg(row_to_json(paged))
              FROM (
                SELECT *
                FROM base
                ORDER BY data_emissao DESC
                LIMIT $${limitParam} OFFSET $${offsetParam}
              ) paged
            ),
            '[]'::json
          ) AS data
      `,
      dataParams,
    );
    const total = result.rows?.[0]?.total || 0;
    const rows = (result.rows?.[0]?.data || []).map((row: any) => ({
      ...row,
      status: row.status_exibicao || row.status || "",
      data_emissao: formatDateOnlyBr(row.data_emissao),
      data_baixa: formatDateOnlyBr(row.data_baixa),
      data_limite_baixa: formatDateOnlyBr(row.data_limite_baixa),
    }));

    return NextResponse.json({ data: rows, total });
  } catch (error) {
    console.error("Erro ao buscar CTes para Dashboard:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
