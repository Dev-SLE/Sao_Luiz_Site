import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { ingestMetaInboundMedia } from "../../../../lib/server/crmMediaIngest";
import { countTrailingClientStreak } from "../../../../lib/server/sofiaStreak";
import { applyInboundRouting } from "../../../../lib/server/crmRouting";
import { ensureDefaultPipelineAndFirstStage } from "../../../../lib/server/crmDefaultPipeline";
import {
  buildSofiaOperationalPrompt,
  buildSofiaSystemInstructions,
} from "../../../../lib/server/sofiaGovernance";
import { crmPhoneSuffixForTitle, crmStripTrailingTitlePhone } from "../../../../lib/server/crmPhoneDisplay";

export const runtime = "nodejs";

function normalizeDigits(input: string) {
  return String(input || "").replace(/\D/g, "");
}

function lastN(input: string, n: number) {
  const d = normalizeDigits(input);
  if (d.length <= n) return d;
  return d.slice(-n);
}

function computeSignatureHex(appSecret: string, rawBody: string) {
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody, "utf8");
  return hmac.digest("hex");
}

function computeSignatureBase64(appSecret: string, rawBody: string) {
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody, "utf8");
  return hmac.digest("base64");
}

function parseWhatsAppText(message: any): string {
  if (!message) return "";
  if (message.type === "text" && message.text?.body) return String(message.text.body);
  if (message.type === "interactive" && message.interactive?.type) {
    // Botões/listas
    const it = message.interactive;
    if (it.type === "button_reply" && it.button_reply?.title) return String(it.button_reply.title);
    if (it.type === "list_reply" && it.list_reply?.title) return String(it.list_reply.title);
  }
  // Midia/unknown
  if (message.type === "image") return message.image?.caption ? String(message.image.caption) : "[Imagem recebida]";
  if (message.type === "audio") return "[Audio recebido]";
  if (message.type === "document") return message.document?.caption ? String(message.document.caption) : "[Documento recebido]";
  if (message.type === "video") return "[Video recebido]";
  return `[Mensagem ${String(message.type || "unknown")} recebida]`;
}

function buildAttachmentMeta(message: any) {
  const type = String(message?.type || "");
  if (!type || type === "text") return [];
  const block = message?.[type] || {};
  return [
    {
      type,
      mediaId: block?.id || null,
      mimeType: block?.mime_type || null,
      sha256: block?.sha256 || null,
      filename: block?.filename || null,
      caption: block?.caption || null,
    },
  ];
}

function extractContextMessageId(message: any): string | null {
  const id = String(message?.context?.id || "").trim();
  return id || null;
}

function extractCteFromText(text: string): string | null {
  const raw = String(text || "");
  if (/^\s*\d{3,12}\s*$/.test(raw)) return raw.trim();
  const longDigits = raw.match(/\b\d{5,}\b/);
  if (longDigits) return longDigits[0];
  const cteHint = raw.match(/\bcte\b[^0-9]{0,10}(\d{3,12})\b/i);
  if (cteHint?.[1]) return cteHint[1];
  return null;
}

function parseWhatsappProfileName(value: any, from: string) {
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const byWaId = contacts.find((c: any) => String(c?.wa_id || "") === String(from || ""));
  const first = byWaId || contacts[0];
  const name = String(first?.profile?.name || "").trim();
  return name || null;
}

function parseLast10List(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  String(raw || "")
    .split(",")
    .map((x) => x.trim().replace(/\D/g, ""))
    .filter(Boolean)
    .forEach((n) => out.add(n.length <= 10 ? n : n.slice(-10)));
  return out;
}

function hasBusinessSignalsMeta(input: { text: string; profileName: string | null; cteDetected: string | null }) {
  if (input.cteDetected) return true;
  const bag = `${String(input.text || "").toLowerCase()} ${String(input.profileName || "").toLowerCase()}`;
  const keywords = [
    "cte",
    "coleta",
    "entrega",
    "rastrei",
    "mercadoria",
    "nf",
    "frete",
    "agencia",
    "agência",
    "cliente",
    "embarque",
    "descarga",
    "cotacao",
    "cotação",
  ];
  return keywords.some((k) => bag.includes(k));
}

async function loadMetaIntakeSettings(pool: any) {
  const res = await pool.query(
    `
      SELECT
        COALESCE(meta_lead_filter_mode, lead_filter_mode, 'BUSINESS_ONLY') AS lead_filter_mode,
        COALESCE(meta_ai_enabled, ai_enabled, true) AS ai_enabled,
        COALESCE(meta_min_messages_before_create, 1) AS min_messages_before_create,
        allowlist_last10,
        denylist_last10
      FROM pendencias.crm_evolution_intake_settings
      WHERE id = 1
      LIMIT 1
    `
  );
  const row = res.rows?.[0] || {};
  return {
    mode: String(row.lead_filter_mode || "BUSINESS_ONLY").toUpperCase(),
    aiEnabled: row.ai_enabled !== false,
    minMessagesBeforeCreate: Math.max(1, Math.min(10, Number(row.min_messages_before_create || 1))),
    allowlist: parseLast10List(row.allowlist_last10),
    denylist: parseLast10List(row.denylist_last10),
  };
}

function mapSenderFromDb(senderType: string) {
  const s = String(senderType || "").toUpperCase();
  if (s === "CLIENT") return "CLIENTE";
  if (s === "AGENT") return "AGENTE";
  if (s === "IA") return "IA";
  return "CLIENTE";
}

async function getOrMergeLeadByPhoneLast10(pool: any, phoneLast10: string) {
  const leadsRes = await pool.query(
    `
      SELECT id, title, contact_phone, created_at
      FROM pendencias.crm_leads
      WHERE contact_phone IS NOT NULL
        AND RIGHT(regexp_replace(contact_phone, '\\D', '', 'g'), 10) = $1
      ORDER BY created_at ASC
    `,
    [phoneLast10]
  );
  const leads = leadsRes.rows || [];
  if (!leads.length) return null;
  const primary = leads[0];
  const primaryId = String(primary.id);
  const duplicateIds = leads.slice(1).map((l: any) => String(l.id));
  if (duplicateIds.length) {
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET lead_id = $1::uuid
        WHERE lead_id = ANY($2::uuid[])
      `,
      [primaryId, duplicateIds]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_activities
        SET lead_id = $1::uuid
        WHERE lead_id = ANY($2::uuid[])
      `,
      [primaryId, duplicateIds]
    );
    await pool.query(
      `
        DELETE FROM pendencias.crm_leads
        WHERE id = ANY($1::uuid[])
      `,
      [duplicateIds]
    );
  }
  return primary;
}

async function getOrMergeWhatsappConversationByLead(pool: any, leadId: string) {
  const convsRes = await pool.query(
    `
      SELECT id, created_at
      FROM pendencias.crm_conversations
      WHERE lead_id = $1::uuid
        AND channel = 'WHATSAPP'
        AND is_active = true
      ORDER BY created_at ASC
    `,
    [leadId]
  );
  const convs = convsRes.rows || [];
  if (!convs.length) return null;
  const primaryId = String(convs[0].id);
  const extraIds = convs.slice(1).map((c: any) => String(c.id));

  if (extraIds.length) {
    await pool.query(
      `
        UPDATE pendencias.crm_messages
        SET conversation_id = $1::uuid
        WHERE conversation_id = ANY($2::uuid[])
      `,
      [primaryId, extraIds]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_outbox
        SET conversation_id = $1::uuid
        WHERE conversation_id = ANY($2::uuid[])
      `,
      [primaryId, extraIds]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET is_active = false, updated_at = NOW()
        WHERE id = ANY($1::uuid[])
      `,
      [extraIds]
    );
  }

  return primaryId;
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
  const hasDestination = /\b(destino|cidade de destino|entrega em|vai para|cidade)\b/.test(full);
  const hasRecipient = /\b(destinat[aá]rio|recebedor|quem vai receber|nome\/cnpj|cnpj)\b/.test(full);
  return {
    cte: cte || "",
    hasDestination,
    hasRecipient,
  };
}

function buildGuidedFallback(input: {
  text: string;
  cteNumber?: string | null;
  customFallback?: string | null;
  lastIaBody?: string | null;
  historyText?: string | null;
  cteSummary?: any;
}) {
  const text = String(input.text || "").toLowerCase();
  const isGreeting =
    /\b(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|blz|beleza)\b/i.test(String(input.text || ""));
  const slots = detectConversationSlots(String(input.historyText || ""));
  const detectedCte = extractCteFromText(input.text || "") || String(input.cteNumber || slots.cte || "").trim() || "";
  const custom = String(input.customFallback || "").trim();
  const cteSummary = input.cteSummary || null;

  const variantsNoCte = [
    "Para eu te ajudar no rastreio com precisão, me informe o número do CTE. Se não tiver, pode me passar NF, remetente, destinatário e cidade de destino.",
    "Vamos resolver isso juntos. Você consegue me enviar o número do CTE? Se não tiver agora, me passe NF e cidade de destino para eu seguir.",
    "Consigo avançar para você agora: me informe o CTE. Sem CTE, me envie NF + destino + nome/CNPJ do destinatário.",
  ];
  let next = "";
  if (!detectedCte) {
    if (isGreeting) {
      next =
        "Olá! Eu sou a Sofia da São Luiz Express. Posso te ajudar no rastreio agora: me informe o CTE. Se não tiver, me envie NF e cidade de destino.";
    } else {
    const idx = Math.abs(String(input.text || "").length + text.length) % variantsNoCte.length;
    next = variantsNoCte[idx];
    }
  } else if (cteSummary) {
    const destino = String(cteSummary.entrega || "").trim() || "não informado";
    const status = String(cteSummary.status_calculado || cteSummary.status || "").trim() || "em análise";
    next = `Encontrei o CTE ${detectedCte} no sistema. Status atual: ${status}. Destino: ${destino}. Para continuar, me confirme o nome/CNPJ do destinatário.`;
  } else if (!slots.hasDestination) {
    next = `Perfeito, recebi o CTE ${detectedCte}. Para eu validar o rastreio agora, me confirme a cidade de destino.`;
  } else if (!slots.hasRecipient) {
    next = `Ótimo, com o CTE ${detectedCte} e destino em mãos. Agora me confirme o nome ou CNPJ do destinatário para eu concluir a triagem.`;
  } else if (text.includes("onde") || text.includes("status") || text.includes("rast")) {
    next = `Perfeito. Recebi o CTE ${detectedCte}. Vou validar o status na unidade responsável. Se puder, me confirme também a cidade de destino para agilizar.`;
  } else if (text.includes("prazo") || text.includes("entrega")) {
    next = `Entendi. Vou validar internamente a previsão do CTE ${detectedCte}. Para acelerar, me confirme a cidade de destino e um telefone para retorno.`;
  } else {
    next = `Recebi sua solicitação sobre o CTE ${detectedCte}. Vou seguir com a validação interna e te manter atualizado aqui no chat.`;
  }

  // Evita repetir exatamente a mesma saída em mensagens seguidas.
  if (input.lastIaBody && String(input.lastIaBody).trim() === next) {
    next = detectedCte
      ? `Para avançar sem atraso no CTE ${detectedCte}, me confirme por favor: cidade de destino e nome de quem está aguardando a entrega.`
      : "Para seguir seu atendimento agora, me informe por favor: número do CTE (ou NF), cidade de destino e nome/CNPJ do destinatário.";
  }

  if (!next && custom) return custom;
  return next || custom || "Recebi sua solicitação e já estou organizando as informações para direcionar ao setor responsável.";
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

async function callOpenAi(prompt: string, modelOverride?: string | null) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    (modelOverride && String(modelOverride).trim()) || process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) return null;
  try {
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
            content: buildSofiaSystemInstructions(null),
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!resp.ok) return null;
    const json = await resp.json().catch(() => ({}));
    return json?.choices?.[0]?.message?.content ? String(json.choices[0].message.content) : null;
  } catch {
    return null;
  }
}

async function callGemini(prompt: string, modelOverride?: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model =
    (modelOverride && String(modelOverride).trim()) || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  if (!apiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.55 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });
    if (!resp.ok) return null;
    const json = await resp.json().catch(() => ({}));
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? String(text) : null;
  } catch {
    return null;
  }
}

async function callAiProvider(opts: { provider?: string | null; prompt: string; modelOverride?: string | null }) {
  const selected = String(opts.provider || process.env.AI_PROVIDER || "OPENAI").toUpperCase();
  if (selected === "GEMINI") {
    const gemini = await callGemini(opts.prompt, opts.modelOverride);
    if (gemini) return gemini;
    return callOpenAi(opts.prompt, process.env.OPENAI_MODEL || null);
  }
  const openai = await callOpenAi(opts.prompt, opts.modelOverride);
  if (openai) return openai;
  return callGemini(opts.prompt, process.env.GEMINI_MODEL || null);
}

async function sendWhatsAppText(toE164: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId || !toE164 || !body.trim()) {
    return { ok: false, response: null as any, error: "Configuração ou payload inválido" };
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toE164,
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, response: json, error: (json as any)?.error?.message || `HTTP ${resp.status}` };
    return { ok: true, response: json, error: null as string | null };
  } catch (e: any) {
    return { ok: false, response: null, error: e?.message || String(e) };
  }
}

function hmToMinutes(hm: string) {
  const [h, m] = String(hm || "00:00").split(":").map((x) => Number(x || 0));
  return h * 60 + m;
}

function weekdayPt(d = new Date()) {
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

/** OpenAI + envio WhatsApp — roda fora do caminho crítico do webhook para responder rápido à Meta. */
export async function runWebhookSofiaAutoReply(
  pool: any,
  ctx: { conversationId: string; leadId: string; from: string; text: string }
) {
  const { conversationId, leadId, from, text } = ctx;
  try {
    const settingsRes = await pool.query(
      `
        SELECT
          name, knowledge_base, auto_reply_enabled, auto_mode, min_confidence,
          max_auto_replies_per_conversation, active_days,
          business_hours_start, business_hours_end,
          escalation_keywords, blocked_topics, blocked_statuses,
          require_human_if_sla_breached, require_human_after_customer_messages,
          model_name, ai_provider, system_instructions, fallback_message, welcome_enabled, welcome_message,
          response_tone, max_response_chars
        FROM pendencias.crm_sofia_settings
        ORDER BY updated_at DESC
        LIMIT 1
      `
    );
    const s = settingsRes.rows?.[0];
    if (!s || !s.auto_reply_enabled) return;
    if (String(s.auto_mode || "ASSISTIDO").toUpperCase() !== "AUTO_TOTAL") return;

    const convInfoRes = await pool.query(
      `
        SELECT c.status, c.topic, c.sla_breached_at, l.title, l.cte_number,
               l.customer_status, l.agency_requested_at, l.agency_sla_minutes
        FROM pendencias.crm_conversations c
        JOIN pendencias.crm_leads l ON l.id = c.lead_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [conversationId]
    );
    const convInfo = convInfoRes.rows?.[0];
    if (!convInfo) return;

    const activeDays = s.active_days && typeof s.active_days === "object" ? s.active_days : {};
    const todayKey = weekdayPt(new Date());
    if (!activeDays[todayKey]) return;

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (nowMins < hmToMinutes(String(s.business_hours_start || "08:00")) || nowMins > hmToMinutes(String(s.business_hours_end || "18:00")))
      return;

    const blockedTopics = Array.isArray(s.blocked_topics) ? s.blocked_topics.map((x: any) => String(x).toUpperCase()) : [];
    if (blockedTopics.includes(String(convInfo.topic || "").toUpperCase())) return;

    const blockedStatuses = Array.isArray(s.blocked_statuses) ? s.blocked_statuses.map((x: any) => String(x).toUpperCase()) : [];
    if (blockedStatuses.includes(String(convInfo.status || "").toUpperCase())) return;
    if (String(convInfo.customer_status || "").toUpperCase() === "AGUARDANDO_RETORNO_AGENCIA") return;

    if (convInfo.agency_requested_at) {
      const requestedAt = new Date(String(convInfo.agency_requested_at)).getTime();
      if (Number.isFinite(requestedAt)) {
        const elapsedMinutes = Math.floor((Date.now() - requestedAt) / 60000);
        const agencySlaMinutes = Number(convInfo.agency_sla_minutes || 60);
        if (elapsedMinutes > agencySlaMinutes) return;
      }
    }

    if (!!s.require_human_if_sla_breached && !!convInfo.sla_breached_at) return;

    const keywordList = Array.isArray(s.escalation_keywords) ? s.escalation_keywords.map((x: any) => String(x).toLowerCase()) : [];
    if (keywordList.some((k: string) => text.toLowerCase().includes(k))) return;

    const historyRes = await pool.query(
      `
        SELECT sender_type, body, created_at
        FROM pendencias.crm_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `,
      [conversationId]
    );
    const iaCount = (historyRes.rows || []).filter((m: any) => String(m.sender_type || "").toUpperCase() === "IA").length;
    const clientCount = (historyRes.rows || []).filter((m: any) => String(m.sender_type || "").toUpperCase() === "CLIENT").length;
    const escalateAfter = Number(s.require_human_after_customer_messages || 4);
    const trailingClientStreak = countTrailingClientStreak(historyRes.rows || []);
    if (trailingClientStreak > escalateAfter) return;
    if (iaCount >= Number(s.max_auto_replies_per_conversation || 2)) return;

    const transcript = (historyRes.rows || [])
      .reverse()
      .map((m: any) => `${String(m.sender_type)}: ${String(m.body)}`)
      .join("\n");
    const contextText = `${transcript}\nCLIENT: ${text}`;
    const cteCandidate = extractCteFromText(text) || String(convInfo.cte_number || "").trim();
    const cteSummary = await lookupCteSummary(pool, cteCandidate);
    const maxResponseChars = Number(s.max_response_chars || 480);
    const minConf = Number(s.min_confidence || 70);
    const confidence = text.length > 80 ? 85 : text.length > 30 ? 75 : 65;
    if (confidence < minConf) return;

    const prompt = buildSofiaOperationalPrompt({
      customerName: convInfo.title,
      cte: convInfo.cte_number,
      topic: convInfo.topic,
      responseTone: s.response_tone,
      supervisorInstructions: s.system_instructions,
      knowledgeBase: s.knowledge_base,
      userText: text,
      cteSummaryText: cteSummary
        ? `CTE ${String(cteSummary.cte || "")} Série ${String(cteSummary.serie || "")} | Status ${String(cteSummary.status_calculado || cteSummary.status || "")} | Destino ${String(cteSummary.entrega || "")} | Destinatário ${String(cteSummary.destinatario || "")}.`
        : null,
    });

    const aiReply = await callAiProvider({
      provider: s.ai_provider,
      prompt,
      modelOverride: s.model_name,
    });
    const normalizedReply = String(aiReply || "").trim();
    const lastIaMessage = (historyRes.rows || []).find(
      (m: any) => String(m.sender_type || "").toUpperCase() === "IA"
    );
    const guidedFallback = buildGuidedFallback({
      text,
      cteNumber: String(convInfo.cte_number || ""),
      customFallback: String(s.fallback_message || ""),
      lastIaBody: lastIaMessage?.body ? String(lastIaMessage.body) : null,
      historyText: contextText,
      cteSummary,
    });
    let finalReply =
      normalizedReply.length > 0
        ? normalizedReply.length > maxResponseChars && maxResponseChars > 0
          ? `${normalizedReply.slice(0, Math.max(1, maxResponseChars - 1)).trimEnd()}…`
          : normalizedReply
        : guidedFallback;
    const previousIa = String(lastIaMessage?.body || "").trim();
    if (
      !finalReply ||
      (previousIa && finalReply === previousIa) ||
      isGenericReply(finalReply)
    ) {
      finalReply = guidedFallback;
    }
    const welcomeEnabled = s.welcome_enabled === undefined ? true : !!s.welcome_enabled;
    const welcomeText = String(s.welcome_message || "").trim();
    const shouldSendWelcome = welcomeEnabled && iaCount === 0 && clientCount <= 1 && welcomeText.length > 0;
    const outboundReply = shouldSendWelcome ? `${welcomeText}\n\n${guidedFallback}` : finalReply;
    if (!outboundReply) return;
    const waSend = await sendWhatsAppText(from, outboundReply);
    if (!waSend.ok) return;

    await pool.query(
      `
        INSERT INTO pendencias.crm_messages (
          conversation_id, sender_type, sender_username, body, has_attachments, metadata, created_at
        )
        VALUES ($1, 'IA', $2, $3, false, $4::jsonb, NOW())
      `,
      [
        conversationId,
        String(s.name || "Sofia"),
        outboundReply,
        JSON.stringify({
          outbound_whatsapp: {
            attempted: true,
            delivered: true,
            status: "sent",
            message_id: waSend.response?.messages?.[0]?.id || null,
          },
          governance: {
            auto_mode: "AUTO_TOTAL",
            confidence,
          },
        }),
      ]
    );
    await pool.query(`UPDATE pendencias.crm_conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
        VALUES ($1, $2, 'EVENT', 'Sofia respondeu automaticamente', $3::jsonb, NOW())
      `,
      [leadId, String(s.name || "Sofia"), JSON.stringify({ conversationId, cteCandidate, cteFound: !!cteSummary })]
    );
  } catch (e) {
    console.error("[whatsapp-webhook] Sofia auto:", e);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "WHATSAPP_VERIFY_TOKEN não configurado" }, { status: 500 });
  }

  if (mode === "subscribe" && token && challenge && token === expected) {
    return new NextResponse(String(challenge), { status: 200 });
  }

  return NextResponse.json({ error: "Verificação falhou" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const rawBody = await req.text();

    if (appSecret) {
      const signature = req.headers.get("x-hub-signature-256") || "";
      const parts = signature.split("=");
      const metaSignature = (parts.length === 2 ? parts[1] : "").trim().toLowerCase();
      const expectedHex = computeSignatureHex(appSecret, rawBody).toLowerCase();
      const expectedBase64 = computeSignatureBase64(appSecret, rawBody).trim();

      // Meta envia sha256 em HEX. Mantemos base64 como fallback defensivo.
      const signatureOk = !!metaSignature && (metaSignature === expectedHex || metaSignature === expectedBase64);
      if (!signatureOk) {
        console.warn("[whatsapp-webhook] Meta assinatura X-Hub-Signature-256 não confere com WHATSAPP_APP_SECRET");
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody || "{}");

    const metaIntake = await loadMetaIntakeSettings(pool).catch(() => ({
      mode: "BUSINESS_ONLY",
      aiEnabled: true,
      minMessagesBeforeCreate: 1,
      allowlist: new Set<string>(),
      denylist: new Set<string>(),
    }));
    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const statuses = value.statuses || [];
        if (statuses.length) {
          for (const st of statuses) {
            const wamid = String(st?.id || "");
            if (!wamid) continue;
            const normalizedStatus = String(st?.status || "").toLowerCase();
            const statusAt = st?.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date();
            const statusPayload = {
              status: normalizedStatus || "unknown",
              timestamp: statusAt.toISOString(),
              recipient_id: st?.recipient_id || null,
              conversation: st?.conversation || null,
              pricing: st?.pricing || null,
              raw: st,
            };

            // Atualiza metadata da mensagem outbound pelo message_id retornado pela Meta.
            await pool.query(
              `
                UPDATE pendencias.crm_messages
                SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                WHERE metadata->'outbound_whatsapp'->>'message_id' = $1
              `,
              [
                wamid,
                JSON.stringify({
                  outbound_whatsapp: {
                    status: normalizedStatus || "unknown",
                    status_at: statusAt.toISOString(),
                    message_id: wamid,
                  },
                }),
              ]
            );

            // Atualiza outbox relacionado (quando houver)
            await pool.query(
              `
                UPDATE pendencias.crm_outbox
                SET
                  status = CASE
                    WHEN $2 IN ('sent','delivered','read') THEN 'SENT'
                    WHEN $2 IN ('failed') THEN 'FAILED'
                    ELSE status
                  END,
                  last_error = CASE WHEN $2 = 'failed' THEN COALESCE(last_error, 'Entrega falhou') ELSE last_error END,
                  updated_at = NOW()
                WHERE message_id IN (
                  SELECT id
                  FROM pendencias.crm_messages
                  WHERE metadata->'outbound_whatsapp'->>'message_id' = $1
                )
              `,
              [wamid, normalizedStatus]
            );

          }
        }

        const messages = value.messages || [];
        if (!messages.length) continue;

        for (const message of messages) {
          const providerMessageId = String(message?.id || "").trim();
          if (providerMessageId) {
            const dupRes = await pool.query(
              `
                SELECT id
                FROM pendencias.crm_messages
                WHERE (provider = 'META' AND provider_message_id = $1)
                   OR metadata->>'message_id' = $1
                   OR metadata#>>'{outbound_whatsapp,message_id}' = $1
                LIMIT 1
              `,
              [providerMessageId]
            );
            if (dupRes.rows?.[0]?.id) continue;
          }
          const from = String(message.from || "");
          const text = parseWhatsAppText(message);
          const cteDetected = extractCteFromText(text);
          const profileName = parseWhatsappProfileName(value, from);
          const contextMessageId = extractContextMessageId(message);

          let resolvedReplyTo: { messageId?: string; sender?: string; text?: string } | null = null;
          if (contextMessageId) {
            const refRes = await pool.query(
              `
                SELECT id, sender_type, body
                FROM pendencias.crm_messages
                WHERE metadata->>'message_id' = $1
                   OR metadata#>>'{outbound_whatsapp,message_id}' = $1
                ORDER BY created_at DESC
                LIMIT 1
              `,
              [contextMessageId]
            );
            const ref = refRes.rows?.[0];
            if (ref?.id) {
              resolvedReplyTo = {
                messageId: String(ref.id),
                sender: mapSenderFromDb(String(ref.sender_type || "")),
                text: String(ref.body || "").slice(0, 280),
              };
            } else {
              resolvedReplyTo = {
                messageId: contextMessageId,
                sender: "Mensagem",
                text: "Mensagem original",
              };
            }
          }

          const last10 = lastN(from, 10);
          const fromDigits = normalizeDigits(from);
          const titlePhoneSuffix = crmPhoneSuffixForTitle(fromDigits);
          const defaultIds = await ensureDefaultPipelineAndFirstStage(pool);
          if (!defaultIds) continue;

          // 1) Resolve lead por telefone (last 10 digits)
          const existingLead = await getOrMergeLeadByPhoneLast10(pool, last10);

          let leadId: string;
          let leadTitle: string;

          if (existingLead?.id) {
            leadId = String(existingLead.id);
            leadTitle = String(existingLead.title || leadId);
            if (profileName && /^whatsapp\s+\d+/i.test(leadTitle)) {
              const upgradedTitle = `${profileName} (${titlePhoneSuffix || from})`;
              await pool.query(
                `UPDATE pendencias.crm_leads SET title = $1, updated_at = NOW() WHERE id = $2`,
                [upgradedTitle, leadId]
              );
              leadTitle = upgradedTitle;
            } else {
              const parenMatch = leadTitle.match(/\((\d+)\)\s*$/);
              const parenDigits = parenMatch?.[1] || "";
              if (
                fromDigits.startsWith("55") &&
                fromDigits.length >= 12 &&
                titlePhoneSuffix.length === 11 &&
                parenDigits &&
                parenDigits !== titlePhoneSuffix
              ) {
                const namePart = crmStripTrailingTitlePhone(leadTitle);
                if (namePart) {
                  const fixedTitle = `${namePart} (${titlePhoneSuffix})`;
                  if (fixedTitle !== leadTitle) {
                    await pool.query(`UPDATE pendencias.crm_leads SET title = $1, updated_at = NOW() WHERE id = $2`, [
                      fixedTitle,
                      leadId,
                    ]);
                    leadTitle = fixedTitle;
                  }
                }
              }
            }
          } else {
            const allowlisted = metaIntake.allowlist.has(last10);
            const denylisted = metaIntake.denylist.has(last10);
            const businessSignal = hasBusinessSignalsMeta({
              text,
              profileName,
              cteDetected,
            });
            const mode = metaIntake.mode;
            // Com meta_min_messages_before_create <= 1 (padrão), a primeira mensagem já gera lead
            // mesmo sem palavra-chave de negócio — senão "oi"/"teste" nunca entra no CRM.
            const firstMessageCreatesLead =
              metaIntake.minMessagesBeforeCreate <= 1 &&
              (String(text || "").trim().length > 0 || String(message?.type || "").trim().length > 0);
            const shouldCreate =
              !denylisted &&
              (mode === "OFF" ||
                allowlisted ||
                (mode === "BUSINESS_ONLY" && (businessSignal || firstMessageCreatesLead)) ||
                (mode === "AGENCY_ONLY" && (businessSignal || firstMessageCreatesLead)));
            if (!shouldCreate) {
              await pool.query(
                `
                  INSERT INTO pendencias.app_logs (level, source, event, username, payload)
                  VALUES ('INFO','crm','CRM_META_INTAKE_WAIT',NULL,$1::jsonb)
                `,
                [
                  JSON.stringify({
                    from,
                    last10,
                    mode,
                    businessSignal,
                    aiEnabled: metaIntake.aiEnabled,
                  }),
                ]
              );
              continue;
            }
            // 2) Cria lead automático para este número
            leadTitle = profileName
              ? `${profileName} (${titlePhoneSuffix || from.slice(-4) || "Lead"})`
              : `WhatsApp (${titlePhoneSuffix || from.slice(-4) || "Lead"})`;

            const leadSource = metaIntake.aiEnabled ? "META_IA" : "WHATSAPP";

            const positionRow = await pool.query(
              `
                SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
                FROM pendencias.crm_leads
                WHERE pipeline_id = $1 AND stage_id = $2
              `,
              [defaultIds.pipelineId, defaultIds.stageId]
            );
            const position = Number(positionRow.rows?.[0]?.next_pos || 0);

            const insertLead = await pool.query(
              `
                INSERT INTO pendencias.crm_leads (
                  pipeline_id,
                  stage_id,
                  title,
                  contact_phone,
                  cte_number,
                  cte_serie,
                  frete_value,
                  source,
                  priority,
                  current_location,
                  owner_username,
                  position,
                  created_at,
                  updated_at
                )
                VALUES ($1,$2,$3,$4,$5,NULL,NULL,$7,'MEDIA',NULL,NULL,$6,NOW(),NOW())
                RETURNING id
              `,
              [defaultIds.pipelineId, defaultIds.stageId, leadTitle, from, cteDetected || null, position, leadSource]
            );
            leadId = insertLead.rows?.[0]?.id as string;

            await pool.query(
              `
                INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
                VALUES ($1, NULL, 'EVENT', $2, '{}'::jsonb, NOW())
              `,
              [leadId, `Lead criado automaticamente via WhatsApp (${from})`]
            );
          }

          // 3) Garante conversation WHATSAPP (número oficial Meta — sem inbox Web)
          let conversationId: string;
          const mergedConversationId = await getOrMergeWhatsappConversationByLead(pool, leadId);
          if (mergedConversationId) {
            conversationId = mergedConversationId;
          } else {
            const insertConv = await pool.query(
              `
                INSERT INTO pendencias.crm_conversations (lead_id, channel, is_active, created_at, last_message_at, whatsapp_inbox_id)
                VALUES ($1, 'WHATSAPP', true, NOW(), NULL, NULL)
                RETURNING id
              `,
              [leadId]
            );
            conversationId = insertConv.rows?.[0]?.id as string;
          }

          // 4) Salva mensagem no banco
          const isAttachment = message.type !== "text";
          const attachments = buildAttachmentMeta(message);
          const insMsg = await pool.query(
            `
              INSERT INTO pendencias.crm_messages (
                conversation_id,
                sender_type,
                provider,
                provider_message_id,
                body,
                has_attachments,
                metadata,
                created_at
              )
              VALUES ($1, 'CLIENT', 'META', $2, $3, $4, $5::jsonb, NOW())
              RETURNING id
            `,
            [
              conversationId,
              providerMessageId || null,
              text || "[Mensagem sem texto]",
              isAttachment,
              JSON.stringify({
                message_type: message.type,
                id: providerMessageId || null,
                message_id: providerMessageId || null,
                attachments,
                ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
                // Guarda o payload bruto pra fase 4 (arquivos)
                raw: message,
              }),
            ]
          );
          const newMessageId = String(insMsg.rows?.[0]?.id || "");
          const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
          if (newMessageId && isAttachment && accessToken) {
            void ingestMetaInboundMedia({
              pool,
              messageId: newMessageId,
              conversationId,
              waMessage: message,
              accessToken,
              providerMessageId: providerMessageId || null,
            }).catch((e) => console.error("[crm-media] meta_async", e));
          }

          await pool.query(
            `
              UPDATE pendencias.crm_conversations
              SET last_message_at = NOW()
              WHERE id = $1
            `,
            [conversationId]
          );

          await pool.query(
            `
              INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
              VALUES ($1, NULL, 'EVENT', 'Mensagem recebida via WhatsApp', $2::jsonb, NOW())
            `,
            [leadId, JSON.stringify({ from, message_type: message.type })]
          );

          // 5) CTE no lead + reabertura de fluxo (novo envio / cliente que voltou após conclusão)
          if (cteDetected) {
            const prevLead = await pool.query(
              `SELECT cte_number, customer_status FROM pendencias.crm_leads WHERE id = $1::uuid`,
              [leadId]
            );
            const prevCte = String(prevLead.rows?.[0]?.cte_number || "").trim();
            const newCte = String(cteDetected).trim();
            const cs = String(prevLead.rows?.[0]?.customer_status || "").trim().toUpperCase();
            const wasClosed =
              cs === "CONCLUIDO" ||
              cs === "PERDIDO" ||
              cs.includes("CONCLU") ||
              cs.includes("FINALIZ");
            const newShipment = Boolean(prevCte && newCte && prevCte !== newCte);
            const reopen = newShipment || (wasClosed && Boolean(newCte));

            await pool.query(
              `
                UPDATE pendencias.crm_leads
                SET
                  cte_number = $1,
                  customer_status = CASE WHEN $3::boolean THEN 'PENDENTE' ELSE customer_status END,
                  updated_at = NOW()
                WHERE id = $2::uuid
              `,
              [newCte, leadId, reopen]
            );

            if (reopen) {
              try {
                await pool.query(
                  `
                    INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
                    VALUES ($1::uuid, NULL, 'EVENT', $2, $3::jsonb, NOW())
                  `,
                  [
                    leadId,
                    newShipment
                      ? "Novo CTE informado — fluxo reaberto para acompanhamento do envio."
                      : "Cliente retornou após atendimento concluído — fluxo reaberto.",
                    JSON.stringify({ previousCte: prevCte || null, newCte, customer_status_reset: true }),
                  ]
                );
              } catch {
                // noop
              }
            }
          }

          // 6) Roteamento: tópico + regras (estágio/atribuição) logo após lead + conversa + mensagem
          try {
            await applyInboundRouting({
              leadId,
              conversationId,
              text,
              title: leadTitle,
              cte: cteDetected,
            });
          } catch (e) {
            console.error("[whatsapp-webhook] applyInboundRouting:", e);
          }

          // 7) Sofia auto via fila persistente (worker processa fora do webhook).
          await pool.query(
            `
              INSERT INTO pendencias.crm_outbox (
                message_id, conversation_id, channel, payload, status, attempts, next_attempt_at, created_at, updated_at
              )
              VALUES (NULL, $1, 'SOFIA_AUTO_REPLY', $2::jsonb, 'PENDING', 0, NOW(), NOW(), NOW())
            `,
            [
              conversationId,
              JSON.stringify({
                leadId,
                from,
                text: text || "[Mensagem sem texto]",
              }),
            ]
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

