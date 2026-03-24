import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { countTrailingClientStreak } from "../../../../../lib/server/sofiaStreak";

export const runtime = "nodejs";

function fallbackReply(input: { customerName?: string; cte?: string; text?: string; customFallback?: string | null }) {
  const lower = String(input.text || "").toLowerCase();
  const cte = String(input.cte || "").trim();
  const custom = String(input.customFallback || "").trim();
  const variantsNoCte = [
    "Para eu te ajudar com precisão, me informe o número do CTE. Se não tiver, pode enviar NF, remetente, destinatário e cidade de destino.",
    "Vamos agilizar: você consegue me informar o CTE? Se não tiver em mãos, me passe NF e cidade de destino.",
    "Consigo avançar agora no seu atendimento. Me envie o CTE; sem ele, me passe NF + destino + nome/CNPJ do destinatário.",
  ];

  if (!cte) {
    const idx = Math.abs(String(input.text || "").length + lower.length) % variantsNoCte.length;
    return variantsNoCte[idx];
  }
  if (lower.includes("prazo") || lower.includes("entrega")) {
    return `Recebi sua dúvida sobre prazo. Vou validar internamente o CTE ${cte} e já te retorno. Se puder, me confirme também a cidade de destino.`;
  }
  if (lower.includes("cte") || lower.includes("rastre")) {
    return `Perfeito, vou validar o rastreio do CTE ${cte} e te retorno em seguida com os detalhes.`;
  }
  if (custom) return custom;
  return `Oi${input.customerName ? `, ${input.customerName}` : ""}! Recebi sua mensagem e já estou verificando para te responder com precisão.`;
}

function getWeekdayKey(d = new Date()) {
  const map: Record<number, string> = {
    0: "domingo",
    1: "segunda",
    2: "terca",
    3: "quarta",
    4: "quinta",
    5: "sexta",
    6: "sabado",
  };
  return map[d.getDay()];
}

function parseHmToMinutes(hm: string | null | undefined) {
  const s = String(hm || "00:00");
  const [h, m] = s.split(":").map((x) => Number(x || 0));
  return h * 60 + m;
}

async function callOpenAi(prompt: string, modelOverride?: string | null) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    (modelOverride && String(modelOverride).trim()) || process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) return null;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content:
            "Você é Sofia, assistente de CRM logístico. Seja cordial, humana e objetiva. Não repita frases idênticas da última resposta. Sempre avance com uma pergunta útil quando faltar dado.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  return json?.choices?.[0]?.message?.content ? String(json.choices[0].message.content) : null;
}

function normalizeAiText(input: string, maxChars: number) {
  const clean = String(input || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!maxChars || maxChars <= 0) return clean;
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function isGenericReply(text: string) {
  const t = String(text || "").toLowerCase();
  if (!t) return true;
  const hasQuestion = t.includes("?") || t.includes("me confirme") || t.includes("me informe");
  const hasCollection = t.includes("cte") || t.includes("nf") || t.includes("destino") || t.includes("destinat");
  const hasGenericPattern =
    t.includes("vou validar internamente") ||
    t.includes("setor responsável") ||
    t.includes("te retornar com segurança") ||
    t.includes("encaminhar ao time");
  return hasGenericPattern && !hasQuestion && !hasCollection;
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const conversationId = body?.conversationId ? String(body.conversationId) : null;
    const text = body?.text ? String(body.text) : "";
    if (!conversationId) return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });

    const [convRes, settingsRes, lastMsgsRes] = await Promise.all([
      pool.query(
        `
          SELECT c.id, c.channel, c.topic, l.title, l.cte_number, l.contact_phone
               , l.customer_status, l.agency_requested_at, l.agency_sla_minutes
               , c.status, c.sla_breached_at
          FROM pendencias.crm_conversations c
          JOIN pendencias.crm_leads l ON l.id = c.lead_id
          WHERE c.id = $1
          LIMIT 1
        `,
        [conversationId]
      ),
      pool.query(
        `
          SELECT
            name, welcome_message, knowledge_base, auto_reply_enabled, escalation_keywords,
            active_days, auto_mode, min_confidence, max_auto_replies_per_conversation,
            business_hours_start, business_hours_end, blocked_topics, blocked_statuses,
            require_human_if_sla_breached, require_human_after_customer_messages,
            model_name, system_instructions, fallback_message, handoff_message,
            response_tone, max_response_chars
          FROM pendencias.crm_sofia_settings
          ORDER BY updated_at DESC
          LIMIT 1
        `
      ),
      pool.query(
        `
          SELECT sender_type, body, created_at
          FROM pendencias.crm_messages
          WHERE conversation_id = $1
          ORDER BY created_at DESC
          LIMIT 30
        `,
        [conversationId]
      ),
    ]);

    const conv = convRes.rows?.[0];
    if (!conv) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });
    const settings = settingsRes.rows?.[0] || {};
    const transcript = (lastMsgsRes.rows || [])
      .reverse()
      .map((m: any) => `${String(m.sender_type)}: ${String(m.body)}`)
      .join("\n");
    const escalationKeywords: string[] = Array.isArray(settings.escalation_keywords)
      ? settings.escalation_keywords.map((x: any) => String(x).toLowerCase())
      : [];
    const shouldEscalate = escalationKeywords.some((k: string) => text.toLowerCase().includes(k));
    const blockedTopics: string[] = Array.isArray(settings.blocked_topics) ? settings.blocked_topics.map((x: any) => String(x).toUpperCase()) : [];
    const blockedStatuses: string[] = Array.isArray(settings.blocked_statuses) ? settings.blocked_statuses.map((x: any) => String(x).toUpperCase()) : [];

    const iaMsgCount = (lastMsgsRes.rows || []).filter((m: any) => String(m.sender_type || "").toUpperCase() === "IA").length;
    const lastIaMessage = (lastMsgsRes.rows || []).find((m: any) => String(m.sender_type || "").toUpperCase() === "IA");
    /** Sequência atual de mensagens do cliente sem resposta (histórico DESC = mais novo primeiro). */
    const trailingClientStreak = countTrailingClientStreak(lastMsgsRes.rows || []);

    const now = new Date();
    const dayKey = getWeekdayKey(now);
    const activeDays = settings.active_days && typeof settings.active_days === "object" ? settings.active_days : {};
    const isDayEnabled = !!activeDays[dayKey];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseHmToMinutes(settings.business_hours_start || "08:00");
    const endMinutes = parseHmToMinutes(settings.business_hours_end || "18:00");
    const isInBusinessHours = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

    const minConfidence = Number(settings.min_confidence || 70);
    const maxAutoReplies = Number(settings.max_auto_replies_per_conversation || 2);
    const requireHumanIfSlaBreached = settings.require_human_if_sla_breached === undefined ? true : !!settings.require_human_if_sla_breached;
    const requireHumanAfterCustomerMessages = Number(settings.require_human_after_customer_messages || 4);
    const autoMode = String(settings.auto_mode || "ASSISTIDO").toUpperCase(); // ASSISTIDO | SEMI_AUTO | AUTO_TOTAL
    const responseTone = String(settings.response_tone || "PROFISSIONAL");
    const maxResponseChars = Number(settings.max_response_chars || 480);

    const prompt = [
      `Nome cliente: ${String(conv.title || "")}`,
      `CTE: ${String(conv.cte_number || "")}`,
      `Tópico: ${String(conv.topic || "")}`,
      `Tom de resposta: ${responseTone}`,
      `Instruções do supervisor: ${String(settings.system_instructions || "")}`,
      `Objetivo operacional: qualificar a conversa para o atendente humano, coletando os dados mínimos (CTE, origem, destino, unidade, ocorrência, urgência).`,
      `Se não houver informação suficiente, faça pergunta curta e direta para avançar o diagnóstico.`,
      `Não repita frase pronta já usada no histórico; varie a formulação mantendo o mesmo sentido.`,
      `Conhecimento: ${String(settings.knowledge_base || "")}`,
      `Histórico:\n${transcript}`,
      `Mensagem atual: ${text}`,
      `Responda em pt-BR, curta e precisa.`,
    ].join("\n\n");

    let suggestion = await callOpenAi(prompt, settings.model_name);
    const fromOpenAi = !!suggestion?.trim();
    if (!suggestion) {
      suggestion = fallbackReply({
        customerName: String(conv.title || ""),
        cte: String(conv.cte_number || ""),
        text,
        customFallback: settings.fallback_message,
      });
    }
    suggestion = normalizeAiText(suggestion, maxResponseChars);
    const prevIaBody = String(lastIaMessage?.body || "").trim();
    if (!suggestion || (prevIaBody && suggestion === prevIaBody) || isGenericReply(suggestion)) {
      suggestion = fallbackReply({
        customerName: String(conv.title || ""),
        cte: String(conv.cte_number || ""),
        text,
        customFallback: null,
      });
      suggestion = normalizeAiText(suggestion, maxResponseChars);
    }

    const confidence = shouldEscalate
      ? 15
      : fromOpenAi
        ? Math.max(minConfidence, 85)
        : text.length > 80
          ? 85
          : text.length > 30
            ? 75
            : 65;

    let allowAutoSend = !!settings.auto_reply_enabled;
    let governanceReason = "ok";

    if (autoMode === "ASSISTIDO") {
      allowAutoSend = false;
      governanceReason = "assistido_mode";
    } else if (autoMode === "SEMI_AUTO") {
      allowAutoSend = false;
      governanceReason = "semi_auto_requires_human_confirm";
    }
    if (!isDayEnabled) {
      allowAutoSend = false;
      governanceReason = "outside_active_day";
    }
    if (!isInBusinessHours) {
      allowAutoSend = false;
      governanceReason = "outside_business_hours";
    }
    if (confidence < minConfidence) {
      allowAutoSend = false;
      governanceReason = "low_confidence";
    }
    if (iaMsgCount >= maxAutoReplies) {
      allowAutoSend = false;
      governanceReason = "max_auto_replies_reached";
    }
    if (blockedTopics.includes(String(conv.topic || "").toUpperCase())) {
      allowAutoSend = false;
      governanceReason = "blocked_topic";
    }
    if (blockedStatuses.includes(String(conv.status || "").toUpperCase())) {
      allowAutoSend = false;
      governanceReason = "blocked_status";
    }
    if (String(conv.customer_status || "").toUpperCase() === "AGUARDANDO_RETORNO_AGENCIA") {
      allowAutoSend = false;
      governanceReason = "agency_waiting_human_followup";
    }
    if (conv.agency_requested_at) {
      const requestedAt = new Date(String(conv.agency_requested_at)).getTime();
      if (Number.isFinite(requestedAt)) {
        const elapsedMinutes = Math.floor((Date.now() - requestedAt) / 60000);
        const agencySlaMinutes = Number(conv.agency_sla_minutes || 60);
        if (elapsedMinutes > agencySlaMinutes) {
          allowAutoSend = false;
          governanceReason = "agency_sla_breached";
        }
      }
    }
    if (requireHumanIfSlaBreached && !!conv.sla_breached_at) {
      allowAutoSend = false;
      governanceReason = "sla_breached";
    }
    if (trailingClientStreak > requireHumanAfterCustomerMessages) {
      allowAutoSend = false;
      governanceReason = "too_many_customer_messages_without_human";
    }
    if (shouldEscalate) {
      allowAutoSend = false;
      governanceReason = "keyword_detected";
    }
    if (!allowAutoSend && String(settings.handoff_message || "").trim()) {
      suggestion = String(settings.handoff_message).trim();
      suggestion = normalizeAiText(suggestion, maxResponseChars);
    }

    return NextResponse.json({
      suggestion,
      autoReplyEnabled: !!settings.auto_reply_enabled,
      shouldEscalate,
      escalateReason: shouldEscalate ? "keyword_detected" : null,
      governance: {
        autoMode,
        allowAutoSend,
        reason: governanceReason,
        confidence,
        minConfidence,
        iaMsgCount,
        maxAutoReplies,
        trailingClientStreak,
        requireHumanAfterCustomerMessages,
      },
      context: {
        topic: conv.topic || null,
        channel: conv.channel || "WHATSAPP",
      },
    });
  } catch (error) {
    console.error("CRM Sofia respond POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

