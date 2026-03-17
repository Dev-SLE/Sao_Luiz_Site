import { getPool } from "./db";

export async function ensureUserTokensTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.user_tokens (
      username text PRIMARY KEY,
      access_token text,
      refresh_token text,
      expiry_date bigint
    )
  `);
}

export async function ensureCteViewIndexTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.cte_view_index (
      cte text NOT NULL,
      serie text NOT NULL,
      view text NOT NULL,
      status_calculado text NOT NULL,
      note_count int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (cte, serie)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cte_view_index_view ON pendencias.cte_view_index (view)`);
}

