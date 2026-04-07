import { getCommercialPool, getPool } from "./db";

let crmSchemaReady = false;
let crmSchemaPromise: Promise<void> | null = null;
let operationalSchemaReady = false;
let operationalSchemaPromise: Promise<void> | null = null;
let operationalAssignmentsReady = false;
let operationalAssignmentsPromise: Promise<void> | null = null;
let commercialSchemaReady = false;
let commercialSchemaPromise: Promise<void> | null = null;
let occurrencesSchemaReady = false;
let occurrencesSchemaPromise: Promise<void> | null = null;

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
  if (crmSchemaReady) return;
  if (crmSchemaPromise) return crmSchemaPromise;
  crmSchemaPromise = (async () => {
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

  // Cadastro fixo de agências (Tipo B)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_agencies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      city text,
      state text,
      phone text,
      whatsapp text,
      contact_name text,
      service_region text,
      avg_response_minutes int,
      internal_rating numeric(4,2),
      notes text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_agencies_name
    ON pendencias.crm_agencies(name)
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
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS topic text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS assigned_team_id uuid`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS assigned_username text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'AUTO'`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS protocol_number text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS mdfe_date timestamptz`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS route_origin text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS route_destination text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now()`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS service_type text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS cargo_status text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS customer_status text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS agency_id uuid`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS agency_requested_at timestamptz`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS agency_sla_minutes int`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS contact_avatar_url text`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS is_recurring_freight boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS tracking_active boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE pendencias.crm_leads ADD COLUMN IF NOT EXISTS observations text`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'crm_leads_agency_id_fkey'
      ) THEN
        ALTER TABLE pendencias.crm_leads
        ADD CONSTRAINT crm_leads_agency_id_fkey
        FOREIGN KEY (agency_id) REFERENCES pendencias.crm_agencies(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_protocol_number
    ON pendencias.crm_leads(protocol_number)
    WHERE protocol_number IS NOT NULL
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
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDENTE'`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS assigned_team_id uuid`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS assigned_username text`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'AUTO'`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS locked_by text`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS locked_at timestamptz`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS topic text`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS routing_source text`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS sla_minutes int`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS sla_due_at timestamptz`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS sla_breached_at timestamptz`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS ai_summary text`);
  await pool.query(`ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS ai_summary_updated_at timestamptz`);
  await pool.query(
    `ALTER TABLE pendencias.crm_conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`
  );

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_conversations_lead_channel
    ON pendencias.crm_conversations(lead_id, channel)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_conversations_assigned_status
    ON pendencias.crm_conversations(assigned_username, status)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_conversations_lock_exp
    ON pendencias.crm_conversations(lock_expires_at)
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

  // Fila de envio outbound (fallback/retry para WhatsApp)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_outbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid REFERENCES pendencias.crm_messages(id) ON DELETE CASCADE,
      conversation_id uuid REFERENCES pendencias.crm_conversations(id) ON DELETE CASCADE,
      channel text NOT NULL DEFAULT 'WHATSAPP',
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'PENDING',
      attempts int NOT NULL DEFAULT 0,
      last_error text,
      next_attempt_at timestamptz NOT NULL DEFAULT NOW(),
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_outbox_status_next_attempt
    ON pendencias.crm_outbox(status, next_attempt_at)
  `);

  // Cadências comerciais (follow-up automático por fase/tempo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_cadences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      stage_id uuid REFERENCES pendencias.crm_stages(id) ON DELETE SET NULL,
      trigger_after_minutes int NOT NULL DEFAULT 1440,
      message_template text NOT NULL,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_cadences_stage_active
    ON pendencias.crm_cadences(stage_id, is_active)
  `);

  // Campanhas outbound com consentimento explícito
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
      message_template text NOT NULL,
      require_opt_in boolean NOT NULL DEFAULT true,
      status text NOT NULL DEFAULT 'DRAFT',
      created_by text,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_campaign_dispatches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL REFERENCES pendencias.crm_campaigns(id) ON DELETE CASCADE,
      lead_id uuid NOT NULL REFERENCES pendencias.crm_leads(id) ON DELETE CASCADE,
      conversation_id uuid REFERENCES pendencias.crm_conversations(id) ON DELETE SET NULL,
      opted_in boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'PENDING',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (campaign_id, lead_id)
    )
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      notes text,
      status text NOT NULL DEFAULT 'OPEN',
      due_at timestamptz,
      assigned_username text NOT NULL,
      created_by text,
      lead_id uuid REFERENCES pendencias.crm_leads(id) ON DELETE SET NULL,
      conversation_id uuid REFERENCES pendencias.crm_conversations(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee_status_due
    ON pendencias.crm_tasks(assigned_username, status, due_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead
    ON pendencias.crm_tasks(lead_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_contact_prefs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_last10 text,
      email_normalized text,
      allow_whatsapp_marketing boolean NOT NULL DEFAULT true,
      allow_campaigns boolean NOT NULL DEFAULT true,
      notes text,
      updated_by text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contact_prefs_phone
    ON pendencias.crm_contact_prefs(phone_last10)
    WHERE phone_last10 IS NOT NULL AND btrim(phone_last10) <> ''
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contact_prefs_email
    ON pendencias.crm_contact_prefs(email_normalized)
    WHERE email_normalized IS NOT NULL AND btrim(email_normalized) <> ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_consent_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_last10 text,
      email_normalized text,
      lead_id uuid REFERENCES pendencias.crm_leads(id) ON DELETE SET NULL,
      event_type text NOT NULL,
      reason text,
      payload jsonb,
      actor_username text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_consent_events_phone
    ON pendencias.crm_consent_events(phone_last10, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_consent_events_email
    ON pendencias.crm_consent_events(email_normalized, created_at DESC)
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
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS escalation_keywords jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS model_name text`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'OPENAI'`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS auto_mode text NOT NULL DEFAULT 'ASSISTIDO'`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS min_confidence int NOT NULL DEFAULT 70`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS max_auto_replies_per_conversation int NOT NULL DEFAULT 2`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS business_hours_start text NOT NULL DEFAULT '08:00'`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS business_hours_end text NOT NULL DEFAULT '18:00'`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS blocked_topics jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS blocked_statuses jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS require_human_if_sla_breached boolean NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS require_human_after_customer_messages int NOT NULL DEFAULT 4`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS system_instructions text`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS fallback_message text`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS handoff_message text`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS response_tone text NOT NULL DEFAULT 'PROFISSIONAL'`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS max_response_chars int NOT NULL DEFAULT 480`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS welcome_enabled boolean NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE pendencias.crm_sofia_settings ADD COLUMN IF NOT EXISTS generate_summary_enabled boolean NOT NULL DEFAULT true`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_evolution_intake_settings (
      id int PRIMARY KEY DEFAULT 1,
      lead_filter_mode text NOT NULL DEFAULT 'BUSINESS_ONLY',
      meta_lead_filter_mode text NOT NULL DEFAULT 'BUSINESS_ONLY',
      ai_enabled boolean NOT NULL DEFAULT true,
      meta_ai_enabled boolean NOT NULL DEFAULT true,
      min_messages_before_create int NOT NULL DEFAULT 2,
      meta_min_messages_before_create int NOT NULL DEFAULT 1,
      allowlist_last10 text,
      denylist_last10 text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT crm_evolution_intake_settings_singleton CHECK (id = 1)
    )
  `);
  await pool.query(`ALTER TABLE pendencias.crm_evolution_intake_settings ADD COLUMN IF NOT EXISTS meta_lead_filter_mode text NOT NULL DEFAULT 'BUSINESS_ONLY'`);
  await pool.query(`ALTER TABLE pendencias.crm_evolution_intake_settings ADD COLUMN IF NOT EXISTS meta_ai_enabled boolean NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE pendencias.crm_evolution_intake_settings ADD COLUMN IF NOT EXISTS meta_min_messages_before_create int NOT NULL DEFAULT 1`);
  await pool.query(`
    INSERT INTO pendencias.crm_evolution_intake_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_whatsapp_inboxes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      phone_number_id text NOT NULL UNIQUE,
      business_account_id text,
      verify_token text,
      app_secret text,
      access_token text,
      is_active boolean NOT NULL DEFAULT true,
      team_id uuid REFERENCES pendencias.crm_teams(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes DROP CONSTRAINT IF EXISTS crm_whatsapp_inboxes_phone_number_id_key`);
  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes ALTER COLUMN phone_number_id DROP NOT NULL`);
  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'META'`);
  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes ADD COLUMN IF NOT EXISTS evolution_instance_name text`);
  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes ADD COLUMN IF NOT EXISTS evolution_server_url text`);
  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes ADD COLUMN IF NOT EXISTS evolution_api_key text`);
  await pool.query(`ALTER TABLE pendencias.crm_whatsapp_inboxes ADD COLUMN IF NOT EXISTS owner_username text`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_wa_inbox_owner_username ON pendencias.crm_whatsapp_inboxes (owner_username)`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_wa_inbox_meta_phone
    ON pendencias.crm_whatsapp_inboxes (phone_number_id)
    WHERE provider = 'META' AND phone_number_id IS NOT NULL AND btrim(phone_number_id) <> ''
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_wa_inbox_evo_instance
    ON pendencias.crm_whatsapp_inboxes (lower(evolution_instance_name))
    WHERE provider = 'EVOLUTION' AND evolution_instance_name IS NOT NULL AND btrim(evolution_instance_name) <> ''
  `);

  await pool.query(`
    ALTER TABLE pendencias.crm_conversations
    ADD COLUMN IF NOT EXISTS whatsapp_inbox_id uuid REFERENCES pendencias.crm_whatsapp_inboxes(id) ON DELETE SET NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_conversations_whatsapp_inbox
    ON pendencias.crm_conversations(whatsapp_inbox_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_evolution_intake_buffer (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inbox_id uuid NOT NULL REFERENCES pendencias.crm_whatsapp_inboxes(id) ON DELETE CASCADE,
      phone_last10 text NOT NULL,
      phone_digits text,
      profile_name text,
      message_count int NOT NULL DEFAULT 0,
      sample_text text,
      business_score int NOT NULL DEFAULT 0,
      last_decision text,
      created_lead_id uuid REFERENCES pendencias.crm_leads(id) ON DELETE SET NULL,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (inbox_id, phone_last10)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      description text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_team_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES pendencias.crm_teams(id) ON DELETE CASCADE,
      username text NOT NULL,
      member_role text NOT NULL DEFAULT 'ATENDENTE',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (team_id, username)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_routing_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      priority int NOT NULL DEFAULT 100,
      is_active boolean NOT NULL DEFAULT true,
      match_type text NOT NULL DEFAULT 'TOPIC',
      match_value text NOT NULL DEFAULT '',
      target_type text NOT NULL DEFAULT 'NONE',
      target_team_id uuid REFERENCES pendencias.crm_teams(id) ON DELETE SET NULL,
      target_username text,
      target_stage_id uuid REFERENCES pendencias.crm_stages(id) ON DELETE SET NULL,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO pendencias.crm_routing_rules (name, priority, is_active, match_type, match_value, target_type, created_at, updated_at)
    SELECT 'SLE | Rastreio', 10, true, 'REGEX', '(rastrear|rastreio|acompanhar|status|onde está|entrega|encomenda|cte)', 'NONE', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM pendencias.crm_routing_rules WHERE name = 'SLE | Rastreio'
    )
  `);
  await pool.query(`
    INSERT INTO pendencias.crm_routing_rules (name, priority, is_active, match_type, match_value, target_type, created_at, updated_at)
    SELECT 'SLE | Cotação', 20, true, 'REGEX', '(cotação|cotacao|orçamento|orcamento|preço|preco|valor do frete|coleta)', 'NONE', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM pendencias.crm_routing_rules WHERE name = 'SLE | Cotação'
    )
  `);
  await pool.query(`
    INSERT INTO pendencias.crm_routing_rules (name, priority, is_active, match_type, match_value, target_type, created_at, updated_at)
    SELECT 'SLE | Financeiro', 30, true, 'REGEX', '(boleto|cobrança|cobranca|pagamento|fatura|vencimento|segunda via)', 'NONE', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM pendencias.crm_routing_rules WHERE name = 'SLE | Financeiro'
    )
  `);
  await pool.query(`
    INSERT INTO pendencias.crm_routing_rules (name, priority, is_active, match_type, match_value, target_type, created_at, updated_at)
    SELECT 'SLE | Ocorrência', 40, true, 'REGEX', '(atraso|avaria|extravio|problema|reclamação|reclamacao|danificada|não chegou|nao chegou)', 'NONE', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM pendencias.crm_routing_rules WHERE name = 'SLE | Ocorrência'
    )
  `);
  await pool.query(`
    INSERT INTO pendencias.crm_routing_rules (name, priority, is_active, match_type, match_value, target_type, created_at, updated_at)
    SELECT 'SLE | Atendimento Humano', 50, true, 'REGEX', '(atendente|humano|pessoa|supervisor|gerente)', 'NONE', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM pendencias.crm_routing_rules WHERE name = 'SLE | Atendimento Humano'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_assignment_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid REFERENCES pendencias.crm_conversations(id) ON DELETE CASCADE,
      lead_id uuid REFERENCES pendencias.crm_leads(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      from_username text,
      to_username text,
      team_id uuid REFERENCES pendencias.crm_teams(id) ON DELETE SET NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_assignment_events_conversation_created
    ON pendencias.crm_assignment_events(conversation_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_queue_sla (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid REFERENCES pendencias.crm_teams(id) ON DELETE CASCADE,
      topic text,
      channel text,
      priority text,
      sla_minutes int NOT NULL DEFAULT 30,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.crm_rr_state (
      scope_key text PRIMARY KEY,
      last_index int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  })();
  try {
    await crmSchemaPromise;
    crmSchemaReady = true;
  } finally {
    crmSchemaPromise = null;
  }
}

export async function ensureOperationalTrackingTables() {
  if (operationalSchemaReady) return;
  if (operationalSchemaPromise) return operationalSchemaPromise;
  operationalSchemaPromise = (async () => {
  const pool = getPool();

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  // Eventos manuais do rastreio operacional (agências).
  // A linha do tempo também vai mesclar com `pendencias.notes` (eventos automáticos via notas).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.operacional_tracking_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cte text NOT NULL,
      serie text NOT NULL,

      -- ROTA: mudou ônibus / passou em parada / observação geral
      -- DESCARGA: recebido / extravio / danificada etc.
      event_kind text NOT NULL DEFAULT 'MANUAL',
      event_type text NOT NULL,
      option_key text,
      observation text,

      bus_name text,
      stop_name text,
      location_text text,
      latitude double precision,
      longitude double precision,

      photos jsonb NOT NULL DEFAULT '[]'::jsonb,

      event_time timestamptz NOT NULL DEFAULT NOW(),
      created_by text,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operacional_tracking_events_cte_serie_time
    ON pendencias.operacional_tracking_events(cte, serie, event_time DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.operational_vehicle_positions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL DEFAULT 'LIFE',
      vehicle_id text,
      plate text,
      lat double precision NOT NULL,
      lng double precision NOT NULL,
      speed double precision,
      heading double precision,
      ignition boolean,
      odometer_km double precision,
      position_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL DEFAULT NOW(),
      raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_vehicle_positions_dedupe
    ON pendencias.operational_vehicle_positions(provider, COALESCE(vehicle_id,''), COALESCE(plate,''), position_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operational_vehicle_positions_plate_time
    ON pendencias.operational_vehicle_positions(plate, position_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operational_vehicle_positions_vehicle_time
    ON pendencias.operational_vehicle_positions(vehicle_id, position_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.operational_load_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cte text NOT NULL,
      serie text NOT NULL DEFAULT '0',
      mdf text,
      vehicle_id text,
      plate text,
      starts_at timestamptz NOT NULL DEFAULT NOW(),
      ends_at timestamptz,
      source text NOT NULL DEFAULT 'MANUAL',
      changed_by text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operational_load_links_cte_serie_starts
    ON pendencias.operational_load_links(cte, serie, starts_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operational_load_links_plate_active
    ON pendencias.operational_load_links(plate, starts_at DESC)
    WHERE ends_at IS NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operational_load_links_vehicle_active
    ON pendencias.operational_load_links(vehicle_id, starts_at DESC)
    WHERE ends_at IS NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_load_links_active_unique
    ON pendencias.operational_load_links(cte, serie)
    WHERE ends_at IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.operational_vehicle_position_latest (
      provider text NOT NULL DEFAULT 'LIFE',
      vehicle_id text,
      plate text,
      lat double precision NOT NULL,
      lng double precision NOT NULL,
      speed double precision,
      heading double precision,
      ignition boolean,
      odometer_km double precision,
      position_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL DEFAULT NOW(),
      raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, plate)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_operational_vehicle_latest_vehicle
    ON pendencias.operational_vehicle_position_latest(vehicle_id, position_at DESC)
  `);
  })();
  try {
    await operationalSchemaPromise;
    operationalSchemaReady = true;
  } finally {
    operationalSchemaPromise = null;
  }
}

export async function ensureOperationalAssignmentsTable() {
  if (operationalAssignmentsReady) return;
  if (operationalAssignmentsPromise) return operationalAssignmentsPromise;
  operationalAssignmentsPromise = (async () => {
    const pool = getPool();
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.cte_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cte text NOT NULL,
        serie text NOT NULL,
        assignment_type text NOT NULL DEFAULT 'PENDENTE_AG_BAIXAR',
        agency_unit text NOT NULL,
        assigned_username text NOT NULL,
        notes text,
        active boolean NOT NULL DEFAULT true,
        created_by text,
        updated_by text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE pendencias.cte_assignments ADD COLUMN IF NOT EXISTS return_reason text`);
    await pool.query(`ALTER TABLE pendencias.cte_assignments ADD COLUMN IF NOT EXISTS returned_by text`);
    await pool.query(`ALTER TABLE pendencias.cte_assignments ADD COLUMN IF NOT EXISTS returned_at timestamptz`);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cte_assignments_active_unique
      ON pendencias.cte_assignments (cte, serie, assignment_type)
      WHERE active = true
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cte_assignments_cte_serie
      ON pendencias.cte_assignments (cte, serie)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cte_assignments_agency_user
      ON pendencias.cte_assignments (agency_unit, assigned_username)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cte_assignments_updated_at
      ON pendencias.cte_assignments (updated_at DESC)
    `);
  })();
  try {
    await operationalAssignmentsPromise;
    operationalAssignmentsReady = true;
  } finally {
    operationalAssignmentsPromise = null;
  }
}

export async function ensureCommercialTables() {
  if (commercialSchemaReady) return;
  if (commercialSchemaPromise) return commercialSchemaPromise;
  commercialSchemaPromise = (async () => {
  const pool = getCommercialPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tb_auditoria_metas (
      id bigserial PRIMARY KEY,
      data_cobranca date NOT NULL DEFAULT CURRENT_DATE,
      agencia text NOT NULL,
      perc_projetado numeric(8,2) NOT NULL DEFAULT 0,
      status_auditoria text NOT NULL DEFAULT 'Aguardando Retorno',
      motivo_queda text,
      resumo_resposta text,
      plano_acao text,
      data_atualizacao timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'MEDIA'`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS responsavel text`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS data_retorno_prevista date`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS retorno_responsavel text`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS conclusao text`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS resultado_evolucao text NOT NULL DEFAULT 'NAO_AVALIADO'`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE public.tb_auditoria_metas ADD COLUMN IF NOT EXISTS concluido_em timestamptz`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tb_auditoria_metas_status ON public.tb_auditoria_metas(status_auditoria)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tb_auditoria_metas_data ON public.tb_auditoria_metas(data_atualizacao DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tb_auditoria_metas_responsavel ON public.tb_auditoria_metas(responsavel)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tb_auditoria_metas_historico (
      id bigserial PRIMARY KEY,
      auditoria_id bigint NOT NULL REFERENCES public.tb_auditoria_metas(id) ON DELETE CASCADE,
      acao text NOT NULL,
      actor text,
      note text,
      previous_status text,
      next_status text,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tb_auditoria_hist_auditoria ON public.tb_auditoria_metas_historico(auditoria_id, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tb_robo_supremo_runs (
      id bigserial PRIMARY KEY,
      mode text,
      status text NOT NULL DEFAULT 'PENDING',
      trigger_source text NOT NULL DEFAULT 'SITE',
      started_at timestamptz NOT NULL DEFAULT NOW(),
      finished_at timestamptz,
      exit_code int,
      pid int,
      stdout_log text,
      stderr_log text,
      created_by text
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tb_robo_supremo_runs_started ON public.tb_robo_supremo_runs(started_at DESC)`);
  })();
  try {
    await commercialSchemaPromise;
    commercialSchemaReady = true;
  } finally {
    commercialSchemaPromise = null;
  }
}

export async function ensureOccurrencesSchemaTables() {
  if (occurrencesSchemaReady) return;
  if (occurrencesSchemaPromise) return occurrencesSchemaPromise;
  occurrencesSchemaPromise = (async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.occurrences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cte text NOT NULL,
        serie text NOT NULL DEFAULT '0',
        occurrence_type text NOT NULL,
        description text NOT NULL,
        status text NOT NULL DEFAULT 'ABERTA',
        source text NOT NULL DEFAULT 'OPERACIONAL',
        lead_id uuid,
        contact_name text,
        contact_phone text,
        created_by text,
        resolution_track text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE pendencias.occurrences ADD COLUMN IF NOT EXISTS resolution_track text`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_occurrences_cte_serie ON pendencias.occurrences(cte, serie, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_occurrences_lead ON pendencias.occurrences(lead_id, created_at DESC)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.indemnifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        occurrence_id uuid NOT NULL REFERENCES pendencias.occurrences(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'ATIVA',
        amount numeric(14,2),
        currency text NOT NULL DEFAULT 'BRL',
        decision text,
        due_date date,
        responsible text,
        legal_risk boolean NOT NULL DEFAULT false,
        notes text,
        created_by text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_indemnifications_occurrence ON pendencias.indemnifications(occurrence_id, created_at DESC)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.dossiers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cte text NOT NULL,
        serie text NOT NULL DEFAULT '0',
        title text NOT NULL,
        status text NOT NULL DEFAULT 'ATIVO',
        generated_by text,
        generated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (cte, serie)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.dossier_events (
        id bigserial PRIMARY KEY,
        dossier_id uuid NOT NULL REFERENCES pendencias.dossiers(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        event_date timestamptz NOT NULL DEFAULT NOW(),
        actor text,
        description text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dossier_events_dossier ON pendencias.dossier_events(dossier_id, event_date DESC)`);

    await pool.query(`ALTER TABLE pendencias.indemnifications ADD COLUMN IF NOT EXISTS facts text`);
    await pool.query(`ALTER TABLE pendencias.indemnifications ADD COLUMN IF NOT EXISTS responsibilities text`);
    await pool.query(`ALTER TABLE pendencias.indemnifications ADD COLUMN IF NOT EXISTS indemnification_body text`);
    await pool.query(`ALTER TABLE pendencias.indemnifications ADD COLUMN IF NOT EXISTS others text`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.indemnification_workflows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        indemnification_id uuid NOT NULL UNIQUE REFERENCES pendencias.indemnifications(id) ON DELETE CASCADE,
        state text NOT NULL DEFAULT 'RASCUNHO',
        current_assignee text,
        previous_assignee text,
        rejection_reason text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_indem_workflows_assignee ON pendencias.indemnification_workflows(current_assignee)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.indemnification_workflow_events (
        id bigserial PRIMARY KEY,
        workflow_id uuid NOT NULL REFERENCES pendencias.indemnification_workflows(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        actor text,
        message text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_indem_wf_events_wf ON pendencias.indemnification_workflow_events(workflow_id, created_at DESC)`
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.indemnification_agency_followups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        indemnification_id uuid NOT NULL REFERENCES pendencias.indemnifications(id) ON DELETE CASCADE,
        agency_id uuid NOT NULL,
        expected_by date,
        responded_at timestamptz,
        response_note_id bigint,
        chase_count int NOT NULL DEFAULT 0,
        last_chase_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (indemnification_id, agency_id)
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_indem_followups_indem ON pendencias.indemnification_agency_followups(indemnification_id)`
    );

    await pool.query(`ALTER TABLE pendencias.notes ADD COLUMN IF NOT EXISTS agency_id uuid`);
    await pool.query(`ALTER TABLE pendencias.notes ADD COLUMN IF NOT EXISTS indemnification_id uuid`);

    await pool.query(`ALTER TABLE pendencias.dossiers ADD COLUMN IF NOT EXISTS finalization_status text`);
    await pool.query(`ALTER TABLE pendencias.dossiers ADD COLUMN IF NOT EXISTS finalized_at timestamptz`);
    await pool.query(`ALTER TABLE pendencias.dossiers ADD COLUMN IF NOT EXISTS finalized_by text`);
    await pool.query(`ALTER TABLE pendencias.dossiers ADD COLUMN IF NOT EXISTS pdf_drive_file_id text`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.dossier_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dossier_id uuid NOT NULL REFERENCES pendencias.dossiers(id) ON DELETE CASCADE,
        category text NOT NULL DEFAULT 'GERAL',
        label text,
        url text NOT NULL,
        drive_file_id text,
        uploaded_by text,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dossier_attachments_dossier ON pendencias.dossier_attachments(dossier_id, created_at DESC)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.ocorrencias_notification_acks (
        username text PRIMARY KEY,
        last_log_id bigint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  })();
  try {
    await occurrencesSchemaPromise;
    occurrencesSchemaReady = true;
  } finally {
    occurrencesSchemaPromise = null;
  }
}

