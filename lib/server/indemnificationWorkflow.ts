import type { Pool } from "pg";
import { ensureAppLogsTable } from "./ensureSchema";

export type WorkflowState =
  | "RASCUNHO"
  | "AGUARDANDO_APROVACAO"
  | "DEVOLVIDO"
  | "APROVADO"
  | "LANCAMENTOS"
  | "AGUARDANDO_FINANCEIRO"
  | "ENCERRADO";

export async function insertOcorrenciasLog(
  pool: Pool,
  event: string,
  username: string | null,
  payload: Record<string, unknown> | null,
  cte: string | null,
  serie: string | null
): Promise<number | null> {
  await ensureAppLogsTable();
  const r = await pool.query(
    `INSERT INTO pendencias.app_logs (level, source, event, username, cte, serie, payload)
     VALUES ('INFO', 'ocorrencias', $1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [event, username, cte, serie, payload ?? null]
  );
  return r.rows?.[0]?.id != null ? Number(r.rows[0].id) : null;
}

export async function ensureIndemnificationWorkflow(pool: Pool, indemnificationId: string) {
  const ex = await pool.query(`SELECT * FROM pendencias.indemnification_workflows WHERE indemnification_id = $1::uuid LIMIT 1`, [
    indemnificationId,
  ]);
  if (ex.rows?.[0]) return ex.rows[0];
  const ins = await pool.query(
    `
      INSERT INTO pendencias.indemnification_workflows (indemnification_id, state, created_at, updated_at)
      VALUES ($1::uuid, 'RASCUNHO', NOW(), NOW())
      RETURNING *
    `,
    [indemnificationId]
  );
  const wf = ins.rows?.[0];
  if (wf) {
    await pool.query(
      `INSERT INTO pendencias.indemnification_workflow_events (workflow_id, event_type, actor, message, payload, created_at)
       VALUES ($1::uuid, 'CREATED', NULL, 'Workflow criado', '{}'::jsonb, NOW())`,
      [wf.id]
    );
  }
  return wf;
}

export async function addWorkflowEvent(
  pool: Pool,
  workflowId: string,
  eventType: string,
  actor: string | null,
  message: string | null,
  payload: Record<string, unknown>
) {
  await pool.query(
    `INSERT INTO pendencias.indemnification_workflow_events (workflow_id, event_type, actor, message, payload, created_at)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb, NOW())`,
    [workflowId, eventType, actor, message, JSON.stringify(payload || {})]
  );
}

export async function loadIndemnificationContext(pool: Pool, indemnificationId: string) {
  const ind = await pool.query(
    `
      SELECT i.*, o.cte AS occurrence_cte, o.serie AS occurrence_serie
      FROM pendencias.indemnifications i
      INNER JOIN pendencias.occurrences o ON o.id = i.occurrence_id
      WHERE i.id = $1::uuid
      LIMIT 1
    `,
    [indemnificationId]
  );
  const indemnification = ind.rows?.[0] || null;
  if (!indemnification) return { indemnification: null, workflow: null, events: [] as any[] };
  const wf = await ensureIndemnificationWorkflow(pool, indemnificationId);
  const ev = await pool.query(
    `SELECT * FROM pendencias.indemnification_workflow_events WHERE workflow_id = $1::uuid ORDER BY created_at ASC`,
    [wf.id]
  );
  return { indemnification, workflow: wf, events: ev.rows || [] };
}

export function isAdminRole(role: string) {
  return String(role || "").toLowerCase() === "admin";
}

export function canActOnWorkflow(
  sessionUsername: string,
  sessionRole: string,
  currentAssignee: string | null | undefined,
  state: string
) {
  if (isAdminRole(sessionRole)) return true;
  if (!currentAssignee) return true;
  return currentAssignee.trim().toLowerCase() === sessionUsername.trim().toLowerCase();
}
