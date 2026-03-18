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

export async function ensureCrmSchemaTables() {
  const pool = getPool();

  // UUID helper
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  // Pipelines (funis)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_pipelines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      is_default boolean NOT NULL DEFAULT false,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_stages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pipeline_id uuid NOT NULL REFERENCES pendencias.crm_pipelines(id) ON DELETE CASCADE,
      name text NOT NULL,
      position int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline_position
    ON pendencias.crm_stages(pipeline_id, position)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pipeline_id uuid NOT NULL REFERENCES pendencias.crm_pipelines(id) ON DELETE CASCADE,
      stage_id uuid REFERENCES pendencias.crm_stages(id) ON DELETE SET NULL,
      title text NOT NULL,
      contact_phone text,
      contact_email text,
      cte_number text,
      cte_serie text,
      frete_value numeric(12,2),
      source text NOT NULL DEFAULT 'MANUAL',
      priority text NOT NULL DEFAULT 'MEDIA',
      current_location text,
      owner_username text,
      position int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline_stage
    ON pendencias.crm_leads(pipeline_id, stage_id, position)
  `);

  // Conversas (um lead pode ter várias: WhatsApp / IA / Interno)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NOT NULL REFERENCES pendencias.crm_leads(id) ON DELETE CASCADE,
      channel text NOT NULL DEFAULT 'WHATSAPP',
      external_id text,
      is_active boolean NOT NULL DEFAULT true,
      last_message_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_conversations_lead_channel
    ON pendencias.crm_conversations(lead_id, channel)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES pendencias.crm_conversations(id) ON DELETE CASCADE,
      sender_type text NOT NULL DEFAULT 'CLIENT',
      sender_username text,
      body text NOT NULL,
      has_attachments boolean NOT NULL DEFAULT false,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_messages_conversation_created
    ON pendencias.crm_messages(conversation_id, created_at)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid REFERENCES pendencias.crm_leads(id) ON DELETE CASCADE,
      user_username text,
      type text NOT NULL DEFAULT 'EVENT',
      description text NOT NULL,
      data jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_created
    ON pendencias.crm_activities(lead_id, created_at DESC)
  `);

  // Config da Sofia (futuro). Por enquanto, ainda pode ficar vazio.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_sofia_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL DEFAULT 'Sofia',
      welcome_message text,
      knowledge_base text,
      active_days jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

