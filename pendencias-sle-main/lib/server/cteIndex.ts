import { getPool } from "./db";
import { ensureCteViewIndexTable } from "./ensureSchema";

const DEFAULT_TOLERANCE_DAYS = parseInt(process.env.DEADLINE_TOLERANCE_DAYS || "2", 10) || 0;

function statusCalculadoSQL() {
  return `
    CASE
      -- 1) Histórico (já baixado): avalia performance passada
      WHEN c.data_baixa IS NOT NULL THEN
        CASE
          WHEN c.data_limite_baixa IS NULL THEN 'CONCLUIDO (SEM LIMITE)'
          WHEN (c.data_limite_baixa::date - c.data_baixa::date) <= -3 THEN 'CONCLUIDO CRÍTICO'
          WHEN (c.data_limite_baixa::date - c.data_baixa::date) < 0 THEN 'CONCLUIDO FORA DO PRAZO'
          ELSE 'CONCLUIDO NO PRAZO'
        END
      -- 2) Operação em aberto (sem baixa): avalia risco atual
      WHEN c.data_limite_baixa IS NULL THEN 'CALCULANDO...'
      WHEN (c.data_limite_baixa::date - CURRENT_DATE) <= -10 THEN 'CRÍTICO'
      WHEN (c.data_limite_baixa::date - CURRENT_DATE) < 0 THEN 'FORA DO PRAZO'
      WHEN (c.data_limite_baixa::date - CURRENT_DATE) = 0 THEN 'PRIORIDADE'
      WHEN (c.data_limite_baixa::date - CURRENT_DATE) = 1 THEN 'VENCE AMANHÃ'
      ELSE 'NO PRAZO'
    END
  `;
}

function normalizedStatusExpr(expr: string) {
  // Normaliza acentos comuns para comparar status textuais com segurança.
  return `TRANSLATE(UPPER(COALESCE(${expr}, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')`;
}

export async function rebuildCteViewIndexAll(toleranceDays = DEFAULT_TOLERANCE_DAYS) {
  const pool = getPool();
  await ensureCteViewIndexTable();

  const sql = `
    WITH latest_process AS (
      SELECT DISTINCT ON (cte, serie)
        cte,
        serie,
        status AS process_status,
        description AS process_description
      FROM pendencias.process_control
      ORDER BY cte, serie, data DESC
    ),
    note_counts AS (
      SELECT cte, COUNT(*)::int AS note_count
      FROM pendencias.notes
      GROUP BY cte
    ),
    computed AS (
      SELECT
        c.cte::text AS cte,
        c.serie::text AS serie,
        COALESCE(nc.note_count, 0) AS note_count,
        ${statusCalculadoSQL()} AS status_calculado,
        CASE
          WHEN c.status IN ('RESOLVIDO', 'LOCALIZADA') THEN 'concluidos'
          WHEN lp.process_status IN ('RESOLVIDO', 'LOCALIZADA') THEN 'concluidos'
          WHEN ${normalizedStatusExpr("c.status")} LIKE 'CONCLUIDO%' THEN 'concluidos'
          WHEN ${normalizedStatusExpr("c.status")} LIKE 'ENTREGUE%' THEN 'concluidos'
          WHEN lp.process_status = 'TAD' THEN 'tad'
          WHEN lp.process_status = 'EM BUSCA' AND UPPER(COALESCE(lp.process_description, '')) LIKE '%TAD%' THEN 'tad'
          WHEN lp.process_status = 'EM BUSCA' THEN 'em_busca'
          WHEN (${statusCalculadoSQL()}) = 'CRÍTICO' THEN 'criticos'
          ELSE 'pendencias'
        END AS view
      FROM pendencias.ctes c
      LEFT JOIN latest_process lp ON lp.cte = c.cte AND lp.serie = c.serie
      LEFT JOIN note_counts nc ON nc.cte = c.cte
    )
    INSERT INTO pendencias.cte_view_index (cte, serie, view, status_calculado, note_count, updated_at)
    SELECT cte, serie, view, status_calculado, note_count, NOW()
    FROM computed
    ON CONFLICT (cte, serie) DO UPDATE SET
      view = EXCLUDED.view,
      status_calculado = EXCLUDED.status_calculado,
      note_count = EXCLUDED.note_count,
      updated_at = NOW()
  `;

  await pool.query(sql);
}

export async function refreshCteViewIndexOne(cte: string, serie: string, toleranceDays = DEFAULT_TOLERANCE_DAYS) {
  const pool = getPool();
  await ensureCteViewIndexTable();

  const sql = `
    WITH latest_process AS (
      SELECT status AS process_status, description AS process_description
      FROM pendencias.process_control
      WHERE cte = $1 AND serie = $2
      ORDER BY data DESC
      LIMIT 1
    ),
    note_counts AS (
      SELECT COUNT(*)::int AS note_count
      FROM pendencias.notes
      WHERE cte = $1
    ),
    computed AS (
      SELECT
        c.cte::text AS cte,
        c.serie::text AS serie,
        (SELECT note_count FROM note_counts) AS note_count,
        ${statusCalculadoSQL()} AS status_calculado,
        CASE
          WHEN c.status IN ('RESOLVIDO', 'LOCALIZADA') THEN 'concluidos'
          WHEN COALESCE((SELECT process_status FROM latest_process), '') IN ('RESOLVIDO', 'LOCALIZADA') THEN 'concluidos'
          WHEN ${normalizedStatusExpr("c.status")} LIKE 'CONCLUIDO%' THEN 'concluidos'
          WHEN ${normalizedStatusExpr("c.status")} LIKE 'ENTREGUE%' THEN 'concluidos'
          WHEN (SELECT process_status FROM latest_process) = 'TAD' THEN 'tad'
          WHEN (SELECT process_status FROM latest_process) = 'EM BUSCA'
            AND UPPER(COALESCE((SELECT process_description FROM latest_process), '')) LIKE '%TAD%'
          THEN 'tad'
          WHEN (SELECT process_status FROM latest_process) = 'EM BUSCA' THEN 'em_busca'
          WHEN (${statusCalculadoSQL()}) = 'CRÍTICO' THEN 'criticos'
          ELSE 'pendencias'
        END AS view
      FROM pendencias.ctes c
      WHERE c.cte = $1 AND c.serie = $2
    )
    INSERT INTO pendencias.cte_view_index (cte, serie, view, status_calculado, note_count, updated_at)
    SELECT cte, serie, view, status_calculado, note_count, NOW()
    FROM computed
    ON CONFLICT (cte, serie) DO UPDATE SET
      view = EXCLUDED.view,
      status_calculado = EXCLUDED.status_calculado,
      note_count = EXCLUDED.note_count,
      updated_at = NOW()
  `;

  await pool.query(sql, [cte, serie]);
}

