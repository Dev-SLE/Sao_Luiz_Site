import type { AiChatHttpResult } from "./aiChatProviders";

export type SofiaAiAuditSource = "sofia_respond" | "evolution_intake" | "meta_webhook_auto";

/**
 * Registro mínimo de chamadas à IA (custos/auditoria). Falhas silenciosas — nunca interrompe o fluxo principal.
 */
export async function insertSofiaAiAuditLog(
  pool: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  row: {
    conversationId?: string | null;
    leadId?: string | null;
    source: SofiaAiAuditSource;
    taskType: string;
    provider: "OPENAI" | "GEMINI";
    modelName: string | null;
    result: AiChatHttpResult;
    meta?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    await pool.query(
      `
        INSERT INTO pendencias.crm_sofia_ai_actions_log (
          conversation_id, lead_id, source, task_type, provider, model_name,
          ok, http_status, error_label, input_tokens, output_tokens, latency_ms, meta
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      `,
      [
        row.conversationId || null,
        row.leadId || null,
        row.source,
        row.taskType,
        row.provider,
        row.modelName,
        row.result.ok,
        row.result.httpStatus || null,
        row.result.errorLabel,
        row.result.inputTokens,
        row.result.outputTokens,
        row.result.latencyMs,
        JSON.stringify(row.meta && Object.keys(row.meta).length ? row.meta : {}),
      ]
    );
  } catch (e) {
    try {
      console.warn("[sofia-ai-audit] insert failed", e instanceof Error ? e.message : String(e));
    } catch {
      /* ignore */
    }
  }
}
