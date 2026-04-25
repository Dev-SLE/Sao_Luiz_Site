import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import {
  normalizeSofiaAutoMode,
  parseAiActionsAllowed,
  parseFunnelSlaRules,
} from "../../../../lib/server/sofiaPolicyHelpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SOFIA"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const res = await pool.query(
      `
        SELECT
          id, name, ai_provider, welcome_message, knowledge_base, active_days,
          auto_reply_enabled, escalation_keywords, model_name,
          auto_mode, min_confidence, max_auto_replies_per_conversation,
          business_hours_start, business_hours_end,
          blocked_topics, blocked_statuses,
          require_human_if_sla_breached, require_human_after_customer_messages,
          system_instructions, fallback_message, handoff_message,
          response_tone, max_response_chars, welcome_enabled, generate_summary_enabled,
          default_language, reply_outside_business_hours, outside_hours_message,
          ai_actions_allowed, funnel_sla_rules,
          updated_at
        FROM pendencias.crm_sofia_settings
        ORDER BY updated_at DESC
        LIMIT 1
      `
    );
    const row = res.rows?.[0];
    const openaiKeyPresent = Boolean(String(process.env.OPENAI_API_KEY || "").trim());
    const geminiKeyPresent = Boolean(String(process.env.GEMINI_API_KEY || "").trim());
    return NextResponse.json({
      aiSecretsStatus: {
        openai: openaiKeyPresent ? "configured" : "missing",
        gemini: geminiKeyPresent ? "configured" : "missing",
      },
      settings: row
        ? {
            id: String(row.id),
            name: String(row.name || "Sofia"),
            aiProvider: String(row.ai_provider || "OPENAI"),
            welcome: row.welcome_message ? String(row.welcome_message) : "",
            knowledgeBase: row.knowledge_base ? String(row.knowledge_base) : "",
            activeDays: row.active_days || {},
            autoReplyEnabled: !!row.auto_reply_enabled,
            escalationKeywords: Array.isArray(row.escalation_keywords) ? row.escalation_keywords : [],
            modelName: row.model_name ? String(row.model_name) : null,
            autoMode: normalizeSofiaAutoMode(row.auto_mode),
            minConfidence: Number(row.min_confidence || 70),
            maxAutoRepliesPerConversation: Number(row.max_auto_replies_per_conversation || 2),
            businessHoursStart: String(row.business_hours_start || "08:00"),
            businessHoursEnd: String(row.business_hours_end || "18:00"),
            blockedTopics: Array.isArray(row.blocked_topics) ? row.blocked_topics : [],
            blockedStatuses: Array.isArray(row.blocked_statuses) ? row.blocked_statuses : [],
            requireHumanIfSlaBreached: !!row.require_human_if_sla_breached,
            requireHumanAfterCustomerMessages: Number(row.require_human_after_customer_messages || 4),
            systemInstructions: row.system_instructions ? String(row.system_instructions) : "",
            fallbackMessage: row.fallback_message ? String(row.fallback_message) : "",
            handoffMessage: row.handoff_message ? String(row.handoff_message) : "",
            responseTone: String(row.response_tone || "PROFISSIONAL"),
            maxResponseChars: Number(row.max_response_chars || 480),
            welcomeEnabled: row.welcome_enabled === undefined ? true : !!row.welcome_enabled,
            generateSummaryEnabled:
              row.generate_summary_enabled === undefined ? true : !!row.generate_summary_enabled,
            defaultLanguage: row.default_language ? String(row.default_language) : "pt-BR",
            replyOutsideBusinessHours: !!row.reply_outside_business_hours,
            outsideHoursMessage: row.outside_hours_message != null ? String(row.outside_hours_message) : "",
            aiActionsAllowed: parseAiActionsAllowed(row.ai_actions_allowed),
            funnelSlaRules: parseFunnelSlaRules(row.funnel_sla_rules),
          }
        : null,
    });
  } catch (error) {
    console.error("CRM Sofia GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SOFIA"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const payload = {
      name: String(body?.name || "Sofia"),
      aiProvider: body?.aiProvider ? String(body.aiProvider).toUpperCase() : "OPENAI",
      welcome: body?.welcome != null ? String(body.welcome) : "",
      knowledgeBase: body?.knowledgeBase != null ? String(body.knowledgeBase) : "",
      activeDays: body?.activeDays && typeof body.activeDays === "object" ? body.activeDays : {},
      autoReplyEnabled: !!body?.autoReplyEnabled,
      escalationKeywords: Array.isArray(body?.escalationKeywords) ? body.escalationKeywords : [],
      modelName: body?.modelName ? String(body.modelName) : null,
      autoMode: normalizeSofiaAutoMode(body?.autoMode ? String(body.autoMode) : "ASSISTIDO"),
      minConfidence: Number(body?.minConfidence ?? 70),
      maxAutoRepliesPerConversation: Number(body?.maxAutoRepliesPerConversation ?? 2),
      businessHoursStart: body?.businessHoursStart ? String(body.businessHoursStart) : "08:00",
      businessHoursEnd: body?.businessHoursEnd ? String(body.businessHoursEnd) : "18:00",
      blockedTopics: Array.isArray(body?.blockedTopics) ? body.blockedTopics : [],
      blockedStatuses: Array.isArray(body?.blockedStatuses) ? body.blockedStatuses : [],
      requireHumanIfSlaBreached: body?.requireHumanIfSlaBreached === undefined ? true : !!body.requireHumanIfSlaBreached,
      requireHumanAfterCustomerMessages: Number(body?.requireHumanAfterCustomerMessages ?? 4),
      systemInstructions: body?.systemInstructions != null ? String(body.systemInstructions) : "",
      fallbackMessage: body?.fallbackMessage != null ? String(body.fallbackMessage) : "",
      handoffMessage: body?.handoffMessage != null ? String(body.handoffMessage) : "",
      responseTone: body?.responseTone ? String(body.responseTone).toUpperCase() : "PROFISSIONAL",
      maxResponseChars: Number(body?.maxResponseChars ?? 480),
      welcomeEnabled: body?.welcomeEnabled === undefined ? true : !!body.welcomeEnabled,
      generateSummaryEnabled:
        body?.generateSummaryEnabled === undefined ? true : !!body.generateSummaryEnabled,
      defaultLanguage: body?.defaultLanguage != null ? String(body.defaultLanguage).trim().slice(0, 16) || "pt-BR" : "pt-BR",
      replyOutsideBusinessHours: !!body?.replyOutsideBusinessHours,
      outsideHoursMessage: body?.outsideHoursMessage != null ? String(body.outsideHoursMessage).slice(0, 2000) : "",
      aiActionsAllowed: parseAiActionsAllowed(body?.aiActionsAllowed),
      funnelSlaRules: parseFunnelSlaRules(body?.funnelSlaRules),
    };

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
            response_tone, max_response_chars, welcome_enabled, generate_summary_enabled,
            default_language, reply_outside_business_hours, outside_hours_message,
            ai_actions_allowed, funnel_sla_rules,
            updated_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28::jsonb, $29::jsonb, NOW())
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
          payload.generateSummaryEnabled,
          payload.defaultLanguage,
          payload.replyOutsideBusinessHours,
          payload.outsideHoursMessage || null,
          JSON.stringify(payload.aiActionsAllowed),
          JSON.stringify(payload.funnelSlaRules),
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
          generate_summary_enabled = $25,
          default_language = $26,
          reply_outside_business_hours = $27,
          outside_hours_message = $28,
          ai_actions_allowed = $29::jsonb,
          funnel_sla_rules = $30::jsonb,
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
        payload.generateSummaryEnabled,
        payload.defaultLanguage,
        payload.replyOutsideBusinessHours,
        payload.outsideHoursMessage || null,
        JSON.stringify(payload.aiActionsAllowed),
        JSON.stringify(payload.funnelSlaRules),
      ]
    );

    return NextResponse.json({ id: String(existing.rows[0].id), success: true });
  } catch (error) {
    console.error("CRM Sofia POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

