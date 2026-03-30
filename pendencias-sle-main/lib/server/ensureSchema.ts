import { getCommercialPool, getPool } from "./db";

let crmSchemaReady = false;
let crmSchemaPromise: Promise<void> | null = null;
let operationalSchemaReady = false;
let operationalSchemaPromise: Promise<void> | null = null;
let commercialSchemaReady = false;
let commercialSchemaPromise: Promise<void> | null = null;

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
      ai_enabled boolean NOT NULL DEFAULT true,
      min_messages_before_create int NOT NULL DEFAULT 2,
      allowlist_last10 text,
      denylist_last10 text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT crm_evolution_intake_settings_singleton CHECK (id = 1)
    )
  `);
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
  })();
  try {
    await operationalSchemaPromise;
    operationalSchemaReady = true;
  } finally {
    operationalSchemaPromise = null;
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

