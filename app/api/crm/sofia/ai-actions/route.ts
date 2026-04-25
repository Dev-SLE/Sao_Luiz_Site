import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../../lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SOFIA"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();

    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get("limit") || "50");
    const rawOffset = Number(url.searchParams.get("offset") || "0");
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50));
    const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0);
    const fetchLimit = limit + 1;

    const res = await pool.query(
      `
        SELECT
          id,
          created_at,
          source,
          task_type,
          provider,
          model_name,
          ok,
          http_status,
          error_label,
          input_tokens,
          output_tokens,
          latency_ms,
          conversation_id,
          lead_id,
          meta
        FROM pendencias.crm_sofia_ai_actions_log
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [fetchLimit, offset]
    );
    const rowsRaw = res.rows || [];
    const hasMore = rowsRaw.length > limit;
    const rows = hasMore ? rowsRaw.slice(0, limit) : rowsRaw;

    const mapped = rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      createdAt: r.created_at,
      source: r.source != null ? String(r.source) : "",
      taskType: r.task_type != null ? String(r.task_type) : "",
      provider: r.provider != null ? String(r.provider) : "",
      modelName: r.model_name != null ? String(r.model_name) : null,
      ok: r.ok === true,
      httpStatus: r.http_status != null ? Number(r.http_status) : null,
      errorLabel: r.error_label != null ? String(r.error_label) : null,
      inputTokens: r.input_tokens != null ? Number(r.input_tokens) : null,
      outputTokens: r.output_tokens != null ? Number(r.output_tokens) : null,
      latencyMs: r.latency_ms != null ? Number(r.latency_ms) : null,
      conversationId: r.conversation_id != null ? String(r.conversation_id) : null,
      leadId: r.lead_id != null ? String(r.lead_id) : null,
      meta: r.meta && typeof r.meta === "object" ? r.meta : {},
    }));

    return NextResponse.json({
      rows: mapped,
      limit,
      offset,
      hasMore,
    });
  } catch (error) {
    console.error("CRM Sofia ai-actions GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
