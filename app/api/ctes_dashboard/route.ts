import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateTime } from "../../../lib/server/datetime";

export const runtime = "nodejs";

/**
 * Dataset consolidado para o Dashboard "Pendências Totais".
 * - Sem "concluidos" (somente views não-concluídas)
 * - 1 registro por (cte, serie) escolhendo a melhor prioridade de view
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "10000", 10) || 10000;
    const offset = (page - 1) * limit;

    const views = ["pendencias", "criticos", "em_busca", "tad"] as const;

    // Total = quantidade de (cte, serie) distinta considerando as views elegíveis
    const pool = getPool();
    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT c.cte, c.serie
          FROM pendencias.cte_view_index i
          JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
          WHERE i.view = ANY($1)
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'CONCLUIDO%'
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'RESOLVIDO%'
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'ENTREGUE%'
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'CANCELADO%'
          GROUP BY c.cte, c.serie
        ) x
      `,
      [views]
    );
    const total = totalResult.rows?.[0]?.total || 0;

    // Seleciona 1 record por (cte, serie) com prioridade de view
    const result = await pool.query(
      `
        WITH ranked AS (
          SELECT
            c.*,
            i.status_calculado,
            i.note_count,
            CASE
              WHEN i.view = 'tad' THEN 'TAD'
              WHEN i.view = 'em_busca' THEN 'EM BUSCA'
              ELSE c.status
            END AS status_exibicao,
            ROW_NUMBER() OVER (
              PARTITION BY c.cte, c.serie
              ORDER BY
                CASE
                  WHEN i.view = 'criticos' THEN 1
                  WHEN i.view = 'tad' THEN 2
                  WHEN i.view = 'em_busca' THEN 3
                  WHEN i.view = 'pendencias' THEN 4
                  ELSE 5
                END,
                c.data_emissao DESC
            ) AS rn
          FROM pendencias.cte_view_index i
          JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
          WHERE i.view = ANY($1)
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'CONCLUIDO%'
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'RESOLVIDO%'
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'ENTREGUE%'
            AND UPPER(COALESCE(c.status, '')) NOT LIKE 'CANCELADO%'
        )
        SELECT
          *
        FROM ranked
        WHERE rn = 1
        ORDER BY data_emissao DESC
        LIMIT $2 OFFSET $3
      `,
      [views, limit, offset]
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
    console.error("Erro ao buscar CTes para Dashboard:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

