import { getPool } from '@/lib/server/db';

let fase1TablesReady = false;
let fase1TablesPromise: Promise<void> | null = null;

/** Tabelas transversais da Fase 1: auditoria, conteúdo do portal, notificações persistidas. */
export async function ensureFase1InfrastructureTables() {
  if (fase1TablesReady) return;
  if (fase1TablesPromise) return fase1TablesPromise;
  fase1TablesPromise = (async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.audit_log (
        id bigserial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        actor_username text,
        action text NOT NULL,
        resource_type text,
        resource_id text,
        payload jsonb,
        ip text
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON pendencias.audit_log (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON pendencias.audit_log (actor_username)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.portal_content (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind text NOT NULL,
        title text NOT NULL,
        body text,
        href text,
        metadata jsonb,
        published_at timestamptz NOT NULL DEFAULT NOW(),
        created_by text
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_content_kind ON pendencias.portal_content (kind)`);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_portal_content_published ON pendencias.portal_content (published_at DESC)`,
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.portal_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        channel text NOT NULL,
        username text,
        status text NOT NULL DEFAULT 'received',
        payload jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_portal_submissions_channel_created ON pendencias.portal_submissions (channel, created_at DESC)`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_submissions_username ON pendencias.portal_submissions (username)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.unified_notification_state (
        id bigserial PRIMARY KEY,
        username text NOT NULL,
        notification_id text NOT NULL,
        read_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_notification_state_user_id ON pendencias.unified_notification_state (LOWER(username), notification_id)`,
    );

    fase1TablesReady = true;
  })();
  return fase1TablesPromise;
}

export async function recordAuditEvent(input: {
  actorUsername: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
}) {
  const pool = getPool();
  await ensureFase1InfrastructureTables();
  await pool.query(
    `
      INSERT INTO pendencias.audit_log (actor_username, action, resource_type, resource_id, payload, ip)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    [
      input.actorUsername,
      input.action,
      input.resourceType ?? null,
      input.resourceId ?? null,
      JSON.stringify(input.payload ?? {}),
      input.ip ?? null,
    ],
  );
}
