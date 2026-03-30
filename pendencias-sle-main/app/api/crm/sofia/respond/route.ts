import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { countTrailingClientStreak } from "../../../../../lib/server/sofiaStreak";

export const runtime = "nodejs";

type AiTurn = {
  role: "user" | "model";
  text: string;
};

function extractCteFromText(text: string): string | null {
  const raw = String(text || "");
  if (/^\s*\d{3,12}\s*$/.test(raw)) return raw.trim();
  const longDigits = raw.match(/\b\d{5,}\b/);
  if (longDigits) return longDigits[0];
  const cteHint = raw.match(/\bcte\b[^0-9]{0,10}(\d{3,12})\b/i);
  if (cteHint?.[1]) return cteHint[1];
  return null;
}

async function lookupCteSummary(pool: any, cteInput: string | null | undefined) {
  const cte = String(cteInput || "").replace(/\D/g, "");
  if (!cte) return null;
  const res = await pool.query(
    `
      SELECT
        c.cte,
        c.serie,
        c.status,
        c.entrega,
        c.destinatario,
        c.data_limite_baixa,
        i.status_calculado
      FROM pendencias.ctes c
      LEFT JOIN pendencias.cte_view_index i ON i.cte = c.cte AND i.serie = c.serie
      WHERE c.cte = $1 OR LTRIM(c.cte, '0') = LTRIM($1, '0')
      ORDER BY c.data_emissao DESC NULLS LAST
      LIMIT 1
    `,
    [cte]
  );
  return res.rows?.[0] || null;
}

function detectConversationSlots(historyText: string) {
  const full = String(historyText || "").toLowerCase();
  const cte = extractCteFromText(full);
  const hasDestination =
    /\b(destino|cidade de destino|entrega em|vai para|cidade)\b/.test(full);
  const hasRecipient =
    /\b(destinat[aá]rio|recebedor|quem vai receber|nome\/cnpj|cnpj)\b/.test(full);
  return {
    cte: cte || "",
    hasDestination,
    hasRecipient,
  };
}

function fallbackReply(input: { customerName?: string; cte?: string; text?: string; customFallback?: string | null }) {
  const lower = String(input.text || "").toLowerCase();
  const isGreeting =
    /\b(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|blz|beleza)\b/i.test(String(input.text || ""));
  const slots = detectConversationSlots(String(input.text || ""));
  const cte = String(input.cte || slots.cte || "").trim();
  const custom = String(input.customFallback || "").trim();
  const variantsNoCte = [
    "Para eu te ajudar com precisão, me informe o número do CTE. Se não tiver, pode enviar NF, remetente, destinatário e cidade de destino.",
    "Vamos agilizar: você consegue me informar o CTE? Se não tiver em mãos, me passe NF e cidade de destino.",
    "Consigo avançar agora no seu atendimento. Me envie o CTE; sem ele, me passe NF + destino + nome/CNPJ do destinatário.",
  ];

  if (!cte) {
    if (isGreeting) {
      return "Olá! Eu sou a Sofia da São Luiz Express. Posso te ajudar no rastreio agora: me informe o CTE. Se não tiver, me envie NF e cidade de destino.";
    }
    const idx = Math.abs(String(input.text || "").length + lower.length) % variantsNoCte.length;
    return variantsNoCte[idx];
  }
  if (!slots.hasDestination) {
    return `Perfeito, recebi o CTE ${cte}. Para eu validar o rastreio agora, me confirme a cidade de destino.`;
  }
  if (!slots.hasRecipient) {
    return `Ótimo, com o CTE ${cte} e destino em mãos. Agora me confirme o nome ou CNPJ do destinatário para eu concluir a triagem.`;
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

function buildAiTurnsFromMessages(rowsDesc: any[]): AiTurn[] {
  const rows = [...(rowsDesc || [])].reverse();
  return rows
    .map((m: any) => {
      const sender = String(m?.sender_type || "").toUpperCase();
      const body = String(m?.body || "").trim();
      if (!body) return null;
      if (sender === "CLIENT") return { role: "user", text: body } as AiTurn;
      return { role: "model", text: body } as AiTurn;
    })
    .filter(Boolean) as AiTurn[];
}

function normalizeForCompare(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isRepeatedAgainstRecentIa(candidate: string, lastIaMessages: string[]) {
  const c = normalizeForCompare(candidate);
  if (!c) return true;
  return lastIaMessages.some((m) => normalizeForCompare(m) === c);
}

async function callOpenAi(args: {
  prompt: string;
  turns: AiTurn[];
  modelOverride?: string | null;
  systemInstructions?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    (args.modelOverride && String(args.modelOverride).trim()) || process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) return null;
  const systemBase =
    "Você é Sofia, assistente de CRM logístico. Seja cordial, humana e objetiva. Não repita frases idênticas da última resposta. Sempre avance com uma pergunta útil quando faltar dado.";
  const customSystem = String(args.systemInstructions || "").trim();
  const messages = [
    { role: "system", content: customSystem ? `${systemBase}\n${customSystem}` : systemBase },
    ...args.turns.map((t) => ({
      role: t.role === "user" ? "user" : "assistant",
      content: t.text,
    })),
    { role: "user", content: args.prompt },
  ];
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages,
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  return json?.choices?.[0]?.message?.content ? String(json.choices[0].message.content) : null;
}

async function callGemini(args: {
  prompt: string;
  turns: AiTurn[];
  modelOverride?: string | null;
  systemInstructions?: string | null;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model =
    (args.modelOverride && String(args.modelOverride).trim()) || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const customSystem = String(args.systemInstructions || "").trim();
  const contents = [
    ...(customSystem
      ? [{ role: "user", parts: [{ text: `Instruções do sistema:\n${customSystem}` }] }]
      : []),
    ...args.turns.map((t) => ({
      role: t.role,
      parts: [{ text: t.text }],
    })),
    { role: "user", parts: [{ text: args.prompt }] },
  ];
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generationConfig: { temperature: 0.55 },
      contents,
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? String(text) : null;
}

async function callAiProvider(opts: {
  provider?: string | null;
  prompt: string;
  turns: AiTurn[];
  modelOverride?: string | null;
  systemInstructions?: string | null;
}) {
  const selected = String(opts.provider || process.env.AI_PROVIDER || "OPENAI").toUpperCase();
  if (selected === "GEMINI") {
    const gemini = await callGemini({
      prompt: opts.prompt,
      turns: opts.turns,
      modelOverride: opts.modelOverride,
      systemInstructions: opts.systemInstructions,
    });
    if (gemini) return gemini;
    return callOpenAi({
      prompt: opts.prompt,
      turns: opts.turns,
      modelOverride: process.env.OPENAI_MODEL || null,
      systemInstructions: opts.systemInstructions,
    });
  }
  const openai = await callOpenAi({
    prompt: opts.prompt,
    turns: opts.turns,
    modelOverride: opts.modelOverride,
    systemInstructions: opts.systemInstructions,
  });
  if (openai) return openai;
  return callGemini({
    prompt: opts.prompt,
    turns: opts.turns,
    modelOverride: process.env.GEMINI_MODEL || null,
    systemInstructions: opts.systemInstructions,
  });
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
    const mode = body?.mode ? String(body.mode).toUpperCase() : "REPLY";
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
            name, ai_provider, welcome_message, knowledge_base, auto_reply_enabled, escalation_keywords,
            active_days, auto_mode, min_confidence, max_auto_replies_per_conversation,
            business_hours_start, business_hours_end, blocked_topics, blocked_statuses,
            require_human_if_sla_breached, require_human_after_customer_messages,
            model_name, system_instructions, fallback_message, handoff_message,
          response_tone, max_response_chars, generate_summary_enabled
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
    const aiTurns = buildAiTurnsFromMessages(lastMsgsRes.rows || []);
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
    const contextText = `${transcript}\nCLIENT: ${text}`;
    const cteCandidate = String(conv.cte_number || extractCteFromText(contextText) || "").trim();
    const cteSummary = await lookupCteSummary(pool, cteCandidate);

    if (mode === "SUMMARY") {
      if (!settings.generate_summary_enabled) {
        return NextResponse.json({ summary: "", skipped: "generate_summary_disabled" });
      }
      const summaryPrompt = [
        "Resuma a conversa em pt-BR para handoff humano.",
        "Formato: 3 bullets curtos com contexto, pendências e próximo passo.",
        "Evite repetição e não invente dados.",
      ].join("\n");
      const summaryRaw =
        (await callAiProvider({
          provider: settings.ai_provider,
          prompt: summaryPrompt,
          turns: aiTurns,
          modelOverride: settings.model_name,
          systemInstructions: settings.system_instructions,
        })) || "";
      const summary = normalizeAiText(summaryRaw || "", 620);
      return NextResponse.json({ summary });
    }

    // C8: intercepta palavra-chave antes de chamar Gemini/OpenAI (handoff imediato).
    if (shouldEscalate) {
      const handoffText = normalizeAiText(
        String(settings.handoff_message || "Entendi. Vou transferir agora seu atendimento para um atendente humano."),
        Number(settings.max_response_chars || 480)
      );
      await pool.query(
        `
          UPDATE pendencias.crm_conversations
          SET status = 'PENDENTE', updated_at = NOW()
          WHERE id = $1
        `,
        [conversationId]
      );
      await pool.query(
        `
          UPDATE pendencias.crm_leads l
          SET customer_status = 'HUMANO_SOLICITADO', updated_at = NOW()
          FROM pendencias.crm_conversations c
          WHERE c.id = $1
            AND l.id = c.lead_id
        `,
        [conversationId]
      );
      await pool.query(
        `
          INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
          SELECT
            c.lead_id,
            NULL,
            'EVENT',
            'Sofia bloqueada por palavra-chave; handoff para humano acionado.',
            $2::jsonb,
            NOW()
          FROM pendencias.crm_conversations c
          WHERE c.id = $1
        `,
        [conversationId, JSON.stringify({ reason: "keyword_detected", text })]
      );
      return NextResponse.json({
        suggestion: handoffText,
        autoReplyEnabled: !!settings.auto_reply_enabled,
        shouldEscalate: true,
        escalateReason: "keyword_detected",
        governance: {
          autoMode: String(settings.auto_mode || "ASSISTIDO").toUpperCase(),
          allowAutoSend: false,
          reason: "keyword_detected",
          confidence: 15,
          minConfidence: Number(settings.min_confidence || 70),
          iaMsgCount,
          maxAutoReplies: Number(settings.max_auto_replies_per_conversation || 2),
          trailingClientStreak,
          requireHumanAfterCustomerMessages: Number(settings.require_human_after_customer_messages || 4),
          handoffShouldAutoSend: true,
        },
        context: {
          topic: conv.topic || null,
          channel: conv.channel || "WHATSAPP",
        },
      });
    }

    const prompt = [
      `Nome cliente: ${String(conv.title || "")}`,
      `CTE: ${String(conv.cte_number || "")}`,
      `Tópico: ${String(conv.topic || "")}`,
      `Tom de resposta: ${responseTone}`,
      `Instruções do supervisor: ${String(settings.system_instructions || "")}`,
      `Objetivo operacional: qualificar a conversa para o atendente humano, coletando os dados mínimos (CTE, origem, destino, unidade, ocorrência, urgência).`,
      `Se não houver informação suficiente, faça pergunta curta e direta para avançar o diagnóstico.`,
      `Não repita frase pronta já usada no histórico; varie a formulação mantendo o mesmo sentido.`,
      cteSummary
        ? `CTE encontrado no banco: CTE ${String(cteSummary.cte || "")} Série ${String(cteSummary.serie || "")} | Status ${String(cteSummary.status_calculado || cteSummary.status || "")} | Destino ${String(cteSummary.entrega || "")} | Destinatário ${String(cteSummary.destinatario || "")}.`
        : "Se o cliente enviar CTE/NF e não houver resultado no banco, avise que não encontrou e peça confirmação do número.",
      `Conhecimento: ${String(settings.knowledge_base || "")}`,
      `Histórico recente já foi enviado por mensagens com papéis user/model.`,
      `Mensagem atual: ${text}`,
      `Responda em pt-BR, curta e precisa.`,
    ].join("\n\n");

    let suggestion = await callAiProvider({
      provider: settings.ai_provider,
      prompt,
      turns: aiTurns,
      modelOverride: settings.model_name,
      systemInstructions: settings.system_instructions,
    });
    const aiGenerated = !!suggestion?.trim();
    if (!suggestion) {
      suggestion = fallbackReply({
        customerName: String(conv.title || ""),
        cte: String(conv.cte_number || extractCteFromText(contextText) || ""),
        text: contextText,
        customFallback: settings.fallback_message,
      });
    }
    suggestion = normalizeAiText(suggestion, maxResponseChars);
    const recentIaBodies = (lastMsgsRes.rows || [])
      .filter((m: any) => String(m.sender_type || "").toUpperCase() === "IA")
      .slice(0, 3)
      .map((m: any) => String(m.body || ""));
    if (!suggestion || isRepeatedAgainstRecentIa(suggestion, recentIaBodies) || isGenericReply(suggestion)) {
      suggestion = fallbackReply({
        customerName: String(conv.title || ""),
        cte: String(conv.cte_number || extractCteFromText(contextText) || ""),
        text: contextText,
        customFallback: null,
      });
      suggestion = normalizeAiText(suggestion, maxResponseChars);
    }

    const confidence = aiGenerated
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

