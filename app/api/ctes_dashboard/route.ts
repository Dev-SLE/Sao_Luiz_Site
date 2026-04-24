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

const VIEWS = ["pendencias", "criticos", "em_busca", "ocorrencias", "tad"] as const;

/**
 * Dataset consolidado para o Dashboard operacional (Visão geral).
 * - Mesmo escopo que `ctes_view`: unidade do perfil + fila de atribuições quando aplicável.
 * - Sem concluídos (exclusão por status normalizado).
 * - 1 registo por (cte, serie) com prioridade de fila (críticos > ocorrências > …).
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

    const N = OPERATIONAL_CTE_STATUS_NORM_SQL.replace(/\s+/g, " ").trim();
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
        LEFT JOIN pendencias.cte_assignments a
          ON a.cte = c.cte
          AND (a.serie = c.serie OR ltrim(a.serie, '0') = ltrim(c.serie, '0'))
          AND a.active = true
          AND a.assignment_type = 'PENDENTE_AG_BAIXAR'
      `
      : "";

    const filterParams: unknown[] = [Array.from(VIEWS)];
    let opScopeFilterSql = "";
    if (!hasOperationalGlobal && (linkedDestUnit || linkedOriginUnit)) {
      filterParams.push(linkedDestUnit || null, linkedOriginUnit || null);
      opScopeFilterSql = operationalCteUnitScopeAndClause(2, 3);
    }
    let assignFilterSql = "";
    if (assignPoolNarrow) {
      filterParams.push(sessionUser);
      assignFilterSql = ` AND (COALESCE(TRIM(a.assigned_username), '') = '' OR LOWER(TRIM(a.assigned_username)) = LOWER(TRIM($${filterParams.length}::text))) `;
    }

    const statusExclusions = `
            AND ${N} NOT LIKE 'CONCLUIDO%'
            AND ${N} NOT LIKE 'RESOLVIDO%'
            AND ${N} NOT LIKE 'ENTREGUE%'
            AND ${N} NOT LIKE 'CANCELADO%'
    `;

    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT c.cte, c.serie
          FROM pendencias.cte_view_index i
          JOIN pendencias.ctes c ON c.cte = i.cte AND (i.serie = c.serie OR ltrim(i.serie, '0') = ltrim(c.serie, '0'))
          ${assignmentJoin}
          WHERE i.view = ANY($1::text[])
            ${statusExclusions}
            ${opScopeFilterSql}
            ${assignFilterSql}
          GROUP BY c.cte, c.serie
        ) x
      `,
      filterParams,
    );
    const total = totalResult.rows?.[0]?.total || 0;

    const limitParam = filterParams.length + 1;
    const offsetParam = filterParams.length + 2;
    const dataParams = [...filterParams, limit, offset];

    const result = await pool.query(
      `
        WITH ranked AS (
          SELECT
            c.*,
            i.status_calculado,
            i.note_count,
            CASE
              WHEN i.view = 'ocorrencias' OR i.view = 'tad' THEN 'OCORRÊNCIA'
              WHEN i.view = 'em_busca' THEN 'EM BUSCA'
              ELSE c.status
            END AS status_exibicao,
            ROW_NUMBER() OVER (
              PARTITION BY c.cte, c.serie
              ORDER BY
                CASE
                  WHEN i.view = 'criticos' THEN 1
                  WHEN i.view = 'ocorrencias' THEN 2
                  WHEN i.view = 'em_busca' THEN 3
                  WHEN i.view = 'pendencias' THEN 4
                  ELSE 5
                END,
                c.data_emissao DESC
            ) AS rn
          FROM pendencias.cte_view_index i
          JOIN pendencias.ctes c ON c.cte = i.cte AND (i.serie = c.serie OR ltrim(i.serie, '0') = ltrim(c.serie, '0'))
          ${assignmentJoin}
          WHERE i.view = ANY($1::text[])
            ${statusExclusions}
            ${opScopeFilterSql}
            ${assignFilterSql}
        )
        SELECT
          *
        FROM ranked
        WHERE rn = 1
        ORDER BY data_emissao DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `,
      dataParams,
    );

    const rows = (result.rows || []).map((row: any) => ({
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
