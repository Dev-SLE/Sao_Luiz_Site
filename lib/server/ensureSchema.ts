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

export async function ensureAppLogsTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.app_logs (
      id bigserial PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      level text NOT NULL DEFAULT 'INFO',
      source text NOT NULL DEFAULT 'app',
      event text NOT NULL,
      username text,
      cte text,
      serie text,
      payload jsonb
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON pendencias.app_logs (created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_logs_event ON pendencias.app_logs (event)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_logs_cte_serie ON pendencias.app_logs (cte, serie)`);
}

