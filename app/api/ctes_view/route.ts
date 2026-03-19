import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateTime } from "../../../lib/server/datetime";

export const runtime = "nodejs";

const NORMALIZED_STATUS_SQL = `
  TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
`;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const view = (searchParams.get("view") || "pendencias").toLowerCase();
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    const viewKey = ["pendencias", "criticos", "em_busca", "tad", "concluidos"].includes(view) ? view : "pendencias";

    const pool = getPool();
    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        WHERE
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
      `,
      [viewKey]
    );
    const total = totalResult.rows?.[0]?.total || 0;

    const result = await pool.query(
      `
        SELECT
          c.*,
          i.status_calculado,
          i.note_count,
          CASE
            WHEN (
              i.view = 'concluidos'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'CONCLUIDO%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'ENTREGUE%'
              OR ${NORMALIZED_STATUS_SQL} LIKE 'RESOLVIDO%'
            ) AND ${NORMALIZED_STATUS_SQL} NOT LIKE 'CONCLUIDO%' THEN 'RESOLVIDO'
            WHEN i.view = 'tad' THEN 'TAD'
            WHEN i.view = 'em_busca' THEN 'EM BUSCA'
            ELSE c.status
          END AS status_exibicao
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        WHERE
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

