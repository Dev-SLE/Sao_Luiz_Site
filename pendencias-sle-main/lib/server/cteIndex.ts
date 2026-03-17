import { getPool } from "./db";
import { ensureCteViewIndexTable } from "./ensureSchema";

const DEFAULT_TOLERANCE_DAYS = parseInt(process.env.DEADLINE_TOLERANCE_DAYS || "2", 10) || 0;

function statusCalculadoSQL(paramIndex: number) {
  return `
    CASE
      WHEN c.data_limite_baixa IS NULL THEN 'NO PRAZO'
      WHEN CURRENT_DATE > (c.data_limite_baixa::date + $${paramIndex}::int) THEN 'CRÍTICO'
      WHEN CURRENT_DATE > (c.data_limite_baixa::date) THEN 'FORA DO PRAZO'
      WHEN CURRENT_DATE = (c.data_limite_baixa::date) THEN 'PRIORIDADE'
      WHEN (CURRENT_DATE + 1) = (c.data_limite_baixa::date) THEN 'VENCE AMANHÃ'
      ELSE 'NO PRAZO'
    END
  `;
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
        ${statusCalculadoSQL(1)} AS status_calculado,
        CASE
          WHEN UPPER(COALESCE(c.status, '')) LIKE 'CONCLUIDO%' THEN 'concluidos'
          WHEN lp.process_status = 'TAD' THEN 'tad'
          WHEN lp.process_status = 'EM BUSCA' AND UPPER(COALESCE(lp.process_description, '')) LIKE '%TAD%' THEN 'tad'
          WHEN lp.process_status = 'EM BUSCA' THEN 'em_busca'
          WHEN (${statusCalculadoSQL(1)}) = 'CRÍTICO' THEN 'criticos'
          ELSE 'pendencias'
        END AS view
      FROM pendencias.ctes c
      LEFT JOIN latest_process lp ON lp.cte = c.cte AND lp.serie = c.serie
      LEFT JOIN note_counts nc ON nc.cte = c.cte
      WHERE c.status NOT IN ('RESOLVIDO', 'LOCALIZADA')
        AND COALESCE(lp.process_status, '') NOT IN ('RESOLVIDO', 'LOCALIZADA')
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

  await pool.query(sql, [toleranceDays]);
}

export async function refreshCteViewIndexOne(cte: string, serie: string, toleranceDays = DEFAULT_TOLERANCE_DAYS) {
  const pool = getPool();
  await ensureCteViewIndexTable();

  const sql = `
    WITH latest_process AS (
      SELECT status AS process_status, description AS process_description
      FROM pendencias.process_control
      WHERE cte = $2 AND serie = $3
      ORDER BY data DESC
      LIMIT 1
    ),
    note_counts AS (
      SELECT COUNT(*)::int AS note_count
      FROM pendencias.notes
      WHERE cte = $2
    ),
    computed AS (
      SELECT
        c.cte::text AS cte,
        c.serie::text AS serie,
        (SELECT note_count FROM note_counts) AS note_count,
        ${statusCalculadoSQL(1)} AS status_calculado,
        CASE
          WHEN UPPER(COALESCE(c.status, '')) LIKE 'CONCLUIDO%' THEN 'concluidos'
          WHEN (SELECT process_status FROM latest_process) = 'TAD' THEN 'tad'
          WHEN (SELECT process_status FROM latest_process) = 'EM BUSCA'
            AND UPPER(COALESCE((SELECT process_description FROM latest_process), '')) LIKE '%TAD%'
          THEN 'tad'
          WHEN (SELECT process_status FROM latest_process) = 'EM BUSCA' THEN 'em_busca'
          WHEN (${statusCalculadoSQL(1)}) = 'CRÍTICO' THEN 'criticos'
          ELSE 'pendencias'
        END AS view
      FROM pendencias.ctes c
      WHERE c.cte = $2 AND c.serie = $3
        AND c.status NOT IN ('RESOLVIDO', 'LOCALIZADA')
        AND COALESCE((SELECT process_status FROM latest_process), '') NOT IN ('RESOLVIDO', 'LOCALIZADA')
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

  await pool.query(sql, [toleranceDays, cte, serie]);
}

