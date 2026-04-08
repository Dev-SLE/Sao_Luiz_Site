import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { getSofiaManualTemplate } from "../../../../../lib/server/sofiaManualTemplate";
import { requireApiPermissions } from "../../../../../lib/server/apiAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS", "module.crm.manage"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const payload = getSofiaManualTemplate();

    const existing = await pool.query("SELECT id FROM pendencias.crm_sofia_settings ORDER BY updated_at DESC LIMIT 1");
    if (!existing.rows?.[0]?.id) {
      const created = await pool.query(
        `
          INSERT INTO pendencias.crm_sofia_settings
          (
            name, welcome_message, knowledge_base, active_days,
            auto_reply_enabled, escalation_keywords, model_name, ai_provider,
            auto_mode, min_confidence, max_auto_replies_per_conversation,
            business_hours_start, business_hours_end, blocked_topics, blocked_statuses,
            require_human_if_sla_breached, require_human_after_customer_messages,
            system_instructions, fallback_message, handoff_message,
            response_tone, max_response_chars, welcome_enabled,
            updated_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
          RETURNING id
        `,
        [
          payload.name,
          payload.welcome,
          payload.knowledgeBase,
          JSON.stringify(payload.activeDays),
          payload.autoReplyEnabled,
          JSON.stringify(payload.escalationKeywords),
          payload.modelName,
          payload.aiProvider,
          payload.autoMode,
          payload.minConfidence,
          payload.maxAutoRepliesPerConversation,
          payload.businessHoursStart,
          payload.businessHoursEnd,
          JSON.stringify(payload.blockedTopics),
          JSON.stringify(payload.blockedStatuses),
          payload.requireHumanIfSlaBreached,
          payload.requireHumanAfterCustomerMessages,
          payload.systemInstructions,
          payload.fallbackMessage,
          payload.handoffMessage,
          payload.responseTone,
          payload.maxResponseChars,
          payload.welcomeEnabled,
        ]
      );
      return NextResponse.json({ id: created.rows?.[0]?.id, success: true });
    }

    await pool.query(
      `
        UPDATE pendencias.crm_sofia_settings
        SET
          name = $2,
          welcome_message = $3,
          knowledge_base = $4,
          active_days = $5::jsonb,
          auto_reply_enabled = $6,
          escalation_keywords = $7::jsonb,
          model_name = $8,
          ai_provider = $9,
          auto_mode = $10,
          min_confidence = $11,
          max_auto_replies_per_conversation = $12,
          business_hours_start = $13,
          business_hours_end = $14,
          blocked_topics = $15::jsonb,
          blocked_statuses = $16::jsonb,
          require_human_if_sla_breached = $17,
          require_human_after_customer_messages = $18,
          system_instructions = $19,
          fallback_message = $20,
          handoff_message = $21,
          response_tone = $22,
          max_response_chars = $23,
          welcome_enabled = $24,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        String(existing.rows[0].id),
        payload.name,
        payload.welcome,
        payload.knowledgeBase,
        JSON.stringify(payload.activeDays),
        payload.autoReplyEnabled,
        JSON.stringify(payload.escalationKeywords),
        payload.modelName,
        payload.aiProvider,
        payload.autoMode,
        payload.minConfidence,
        payload.maxAutoRepliesPerConversation,
        payload.businessHoursStart,
        payload.businessHoursEnd,
        JSON.stringify(payload.blockedTopics),
        JSON.stringify(payload.blockedStatuses),
        payload.requireHumanIfSlaBreached,
        payload.requireHumanAfterCustomerMessages,
        payload.systemInstructions,
        payload.fallbackMessage,
        payload.handoffMessage,
        payload.responseTone,
        payload.maxResponseChars,
        payload.welcomeEnabled,
      ]
    );

    return NextResponse.json({ id: String(existing.rows[0].id), success: true });
  } catch (error) {
    console.error("CRM Sofia template POST error:", error);
    return NextResponse.json({ error: "Erro interno ao aplicar template da Sofia" }, { status: 500 });
  }
}

