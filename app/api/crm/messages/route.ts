import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { evolutionDeleteMessageForEveryone, evolutionSendText } from "../../../../lib/server/evolutionClient";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { sessionCanAccessLead } from "../../../../lib/server/crmAccess";

export const runtime = "nodejs";

function mapSenderToDb(senderType: string) {
  const s = String(senderType || "").toUpperCase();
  if (s === "CLIENTE" || s === "CLIENT") return "CLIENT";
  if (s === "AGENTE" || s === "AGENT") return "AGENT";
  if (s === "IA") return "IA";
  return "CLIENT";
}

function mapSenderFromDb(senderType: string) {
  const s = String(senderType || "").toUpperCase();
  if (s === "CLIENT") return "CLIENTE";
  if (s === "AGENT") return "AGENTE";
  if (s === "IA") return "IA";
  return "CLIENTE";
}

function formatTime(d: Date | null | undefined) {
  if (!d) return "--";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function safeJsonParse(value: any) {
  if (value == null) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

/** JID do contato (ex.: 5511...@s.whatsapp.net) a partir de metadata ou do telefone do lead. */
function ensureWhatsAppJid(raw: string | null | undefined, fallbackE164Digits: string | null): string {
  const t = String(raw || "").trim();
  if (t && t.includes("@")) return t;
  const d = (t ? t.replace(/\D/g, "") : "") || String(fallbackE164Digits || "").replace(/\D/g, "");
  if (!d) return "";
  return `${d}@s.whatsapp.net`;
}

function resolveQuotedMessageContext(
  refRow: any,
  customerE164Digits: string | null
): {
  metaQuotedId: string | null;
  evolutionQuoted: {
    waMessageId: string;
    remoteJid: string;
    fromMe: boolean;
    conversation: string;
  } | null;
} {
  if (!refRow) return { metaQuotedId: null, evolutionQuoted: null };
  const refMeta = safeJsonParse(refRow.metadata);
  const ob = refMeta?.outbound_whatsapp;
  const waId =
    String(refRow.provider_message_id || "").trim() ||
    String(ob?.message_id || "").trim() ||
    String(refMeta?.message_id || "").trim() ||
    String(refMeta?.id || "").trim() ||
    null;
  const st = String(refRow.sender_type || "").toUpperCase();
  const fromMe = st === "AGENT" || st === "IA";
  const remoteJid = ensureWhatsAppJid(refMeta?.remote_jid || ob?.remote_jid || null, customerE164Digits);
  const conversation = String(refRow.body || "").trim().slice(0, 900) || " ";
  const evolutionQuoted =
    waId && remoteJid
      ? { waMessageId: waId, remoteJid, fromMe, conversation }
      : null;
  return { metaQuotedId: waId, evolutionQuoted };
}

function normalizePhoneToE164(phoneRaw: string | null | undefined) {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return null;
  // Regras simples BR para início de operação:
  // - se já vier com DDI 55, mantém
  // - caso contrário, prefixa 55
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function normalizeAttendantLabel(raw: string | null | undefined) {
  const name = String(raw || "").trim();
  if (!name) return "Atendente";
  // "joao.silva" -> "Joao Silva"
  const cleaned = name.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Remove caracteres que o WhatsApp interpreta como formatação, para o nome no *negrito* não quebrar. */
function stripWhatsappFormattingFromLabel(raw: string) {
  return String(raw || "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWhatsappSignedBody(args: {
  text: string;
  senderType: string;
  senderUsername?: string | null;
}) {
  const text = String(args.text || "").trim();
  if (!text) return text;
  const sender = String(args.senderType || "").toUpperCase();
  // Padrão solicitado: identificar quem atendeu no WhatsApp (*negrito* + quebra de linha — sintaxe oficial do app).
  if (sender !== "AGENT" && sender !== "IA") return text;
  const labelRaw =
    sender === "IA"
      ? `${normalizeAttendantLabel(args.senderUsername || "Sofia")} (IA)`
      : normalizeAttendantLabel(args.senderUsername);
  const label = stripWhatsappFormattingFromLabel(labelRaw) || "Atendente";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Já no formato novo *Nome*:\n ou legado "Nome: " na mesma linha
  if (new RegExp(`^\\*${escaped}\\*:\\s*\\n?`, "i").test(text)) return text;
  if (new RegExp(`^${escaped}\\s*:\\s*`, "i").test(text)) return text;
  return `*${label}*:\n${text}`;
}

async function sendWhatsAppText(args: { toE164: string; body: string; quotedMessageId?: string | null }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      error: "WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado",
      response: null as any,
    };
  }

  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: args.toE164,
    type: "text",
    text: { preview_url: false, body: args.body },
    ...(args.quotedMessageId ? { context: { message_id: String(args.quotedMessageId) } } : {}),
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        ok: false,
        error: (json as any)?.error?.message || `Erro HTTP ${resp.status}`,
        response: json,
      };
    }
    return { ok: true, error: null as string | null, response: json };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), response: null as any };
  }
}

function toDirectDownloadUrl(rawUrl: string) {
  const url = String(rawUrl || "");
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return url;
}

async function sendWhatsAppAttachment(args: {
  toE164: string;
  attachment: { type?: string; filename?: string; url?: string };
  caption?: string;
  quotedMessageId?: string | null;
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: "WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado", response: null as any };
  }
  const mediaUrl = toDirectDownloadUrl(String(args.attachment?.url || ""));
  if (!mediaUrl) return { ok: false, error: "attachment url obrigatório", response: null as any };
  const typeRaw = String(args.attachment?.type || "").toLowerCase();
  const isImage = typeRaw.includes("image");
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: args.toE164,
    type: isImage ? "image" : "document",
    ...(args.quotedMessageId ? { context: { message_id: String(args.quotedMessageId) } } : {}),
  };
  if (isImage) {
    payload.image = {
      link: mediaUrl,
      caption: args.caption || undefined,
    };
  } else {
    payload.document = {
      link: mediaUrl,
      filename: args.attachment?.filename || "arquivo",
      caption: args.caption || undefined,
    };
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: (json as any)?.error?.message || `Erro HTTP ${resp.status}`, response: json };
    return { ok: true, error: null, response: json };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), response: null };
  }
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const session = await getSessionContext(req);
    if (!session || !can(session, "tab.crm.chat.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
    }

    const result = await pool.query(
      `
        SELECT
          m.id,
          m.sender_type,
          m.body,
          m.metadata,
          m.created_at,
          c.channel
        FROM pendencias.crm_messages m
        JOIN pendencias.crm_conversations c ON c.id = m.conversation_id
        WHERE m.conversation_id = $1
          AND (m.metadata->>'update_fallback' IS DISTINCT FROM 'true')
        ORDER BY m.created_at ASC
        LIMIT 500
      `,
      [conversationId]
    );

    const convInfo = await pool.query(
      `
        SELECT lead_id
        FROM pendencias.crm_conversations
        WHERE id = $1
        LIMIT 1
      `,
      [conversationId]
    );
    const leadId = convInfo.rows?.[0]?.lead_id as string | undefined;
    if (!leadId || !(await sessionCanAccessLead(pool, session, String(leadId)))) {
      return NextResponse.json({ error: "Sem acesso a esta conversa" }, { status: 403 });
    }

    let relatedLeadHistory: Array<{
      messageId: string;
      conversationId: string;
      body: string;
      senderType: string;
      channel: string;
      inboxName: string | null;
      createdAt: string;
      time: string;
    }> = [];

    if (leadId) {
      const relatedRes = await pool.query(
        `
          SELECT
            m.id AS message_id,
            m.conversation_id,
            m.body,
            m.sender_type,
            c.channel,
            wi.name AS inbox_name,
            m.created_at
          FROM pendencias.crm_messages m
          JOIN pendencias.crm_conversations c ON c.id = m.conversation_id
          LEFT JOIN pendencias.crm_whatsapp_inboxes wi ON wi.id = c.whatsapp_inbox_id
          WHERE c.lead_id = $1::uuid
            AND c.id <> $2::uuid
            AND (m.metadata->>'update_fallback' IS DISTINCT FROM 'true')
          ORDER BY m.created_at DESC
          LIMIT 12
        `,
        [leadId, conversationId]
      );
      relatedLeadHistory = (relatedRes.rows || []).map((r: any) => ({
        messageId: String(r.message_id),
        conversationId: String(r.conversation_id),
        body: String(r.body || ""),
        senderType: mapSenderFromDb(String(r.sender_type || "")),
        channel: String(r.channel || "WHATSAPP"),
        inboxName: r.inbox_name ? String(r.inbox_name) : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
        time: formatTime(r.created_at ? new Date(r.created_at) : null),
      }));
    }

    const messages = (result.rows || []).map((r: any) => {
      const meta = safeJsonParse(r.metadata);
      const outbound = meta?.outbound_whatsapp;
      const senderUpper = String(r.sender_type || "").toUpperCase();
      const delivered =
        outbound?.delivered === true ||
        outbound?.delivered === "true" ||
        outbound?.status === "sent" ||
        outbound?.status === "delivered";
      const statusForUi =
        outbound?.status ||
        (senderUpper === "CLIENT"
          ? "received"
          : delivered
            ? "delivered"
            : "pending");
      return {
      metadata: meta,
      id: r.id as string,
      from: mapSenderFromDb(r.sender_type),
      fromLabel: meta?.sender_label ? String(meta.sender_label) : undefined,
      text: String(r.body || ""),
      replyTo: meta?.reply_to || null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      time: formatTime(r.created_at ? new Date(r.created_at) : null),
      channel: String(r.channel || "WHATSAPP") as any,
      status: statusForUi,
      edited: Boolean(meta?.wa_edited || meta?.edited_at),
      deleted: Boolean(meta?.deleted_at),
      attachments: Array.isArray(meta?.attachments) ? meta.attachments : [],
    };
    });

    return NextResponse.json({ messages, relatedLeadHistory });
  } catch (error) {
    console.error("CRM messages GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const session = await getSessionContext(req);
    if (!session || !can(session, "crm.messages.send")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const senderType = String(body?.senderType || "AGENTE");
    const text = String(body?.body || "").trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    const replyTo = body?.replyTo && typeof body.replyTo === "object" ? body.replyTo : null;
    if (!text && attachments.length === 0) {
      return NextResponse.json({ error: "body ou attachments obrigatório" }, { status: 400 });
    }

    const conversationId = body?.conversationId ? String(body.conversationId) : null;
    const leadId = body?.leadId ? String(body.leadId) : null;
    const channel = body?.channel ? String(body.channel) : "WHATSAPP";

    let activeConversationId = conversationId;
    let activeChannel = channel;

    if (!activeConversationId) {
      if (!leadId) return NextResponse.json({ error: "leadId ou conversationId obrigatório" }, { status: 400 });
      if (!(await sessionCanAccessLead(pool, session, leadId))) {
        return NextResponse.json({ error: "Sem acesso ao lead" }, { status: 403 });
      }

      const convInsert = await pool.query(
        `
          INSERT INTO pendencias.crm_conversations (lead_id, channel, is_active, created_at, last_message_at)
          VALUES ($1, $2, true, NOW(), NOW())
          RETURNING id, channel
        `,
        [leadId, channel]
      );
      activeConversationId = convInsert.rows?.[0]?.id as string;
      activeChannel = convInsert.rows?.[0]?.channel as string;
    } else {
      const convRes = await pool.query(
        "SELECT channel, lead_id FROM pendencias.crm_conversations WHERE id = $1",
        [activeConversationId]
      );
      const convLeadId = convRes.rows?.[0]?.lead_id ? String(convRes.rows[0].lead_id) : null;
      if (!convLeadId || !(await sessionCanAccessLead(pool, session, convLeadId))) {
        return NextResponse.json({ error: "Sem acesso a esta conversa" }, { status: 403 });
      }
      activeChannel = convRes.rows?.[0]?.channel ? String(convRes.rows[0].channel) : activeChannel;
    }

    const dbSender = mapSenderToDb(senderType);
    const messageInsert = await pool.query(
      `
        INSERT INTO pendencias.crm_messages (conversation_id, sender_type, provider, provider_message_id, body, has_attachments, metadata, created_at)
        VALUES ($1, $2, 'CRM', NULL, $3, $4, $5::jsonb, NOW())
        RETURNING id, created_at
      `,
      [
        activeConversationId,
        dbSender,
        text || "[Anexo]",
        attachments.length > 0,
        JSON.stringify({
          attachments,
          ...(replyTo
            ? {
                reply_to: {
                  messageId: replyTo.messageId ? String(replyTo.messageId) : null,
                  sender: replyTo.sender ? String(replyTo.sender) : null,
                  text: replyTo.text ? String(replyTo.text).slice(0, 280) : null,
                },
              }
            : {}),
        }),
      ]
    );
    const createdMessageId = messageInsert.rows?.[0]?.id as string;

    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET last_message_at = NOW()
        WHERE id = $1
      `,
      [activeConversationId]
    );

    let outboundWhatsApp: {
      attempted: boolean;
      delivered: boolean;
      error?: string | null;
      response?: any;
    } = {
      attempted: false,
      delivered: false,
      error: null,
      response: null,
    };

    // Canal WHATSAPP: atendente OU Sofia (IA) disparam envio real pela Cloud API.
    const shouldSendWhatsApp =
      String(activeChannel).toUpperCase() === "WHATSAPP" &&
      (dbSender === "AGENT" || dbSender === "IA");
    if (shouldSendWhatsApp) {
      outboundWhatsApp.attempted = true;
      const signedText = buildWhatsappSignedBody({
        text,
        senderType: dbSender,
        senderUsername: body?.senderUsername != null ? String(body.senderUsername) : session.username,
      });
      const leadInfo = await pool.query(
        `
          SELECT
            l.contact_phone,
            i.provider AS inbox_provider,
            i.evolution_instance_name,
            i.evolution_server_url,
            i.evolution_api_key
          FROM pendencias.crm_conversations c
          JOIN pendencias.crm_leads l ON l.id = c.lead_id
          LEFT JOIN pendencias.crm_whatsapp_inboxes i ON i.id = c.whatsapp_inbox_id
          WHERE c.id = $1
          LIMIT 1
        `,
        [activeConversationId]
      );
      const row = leadInfo.rows?.[0];
      const contactPhone = row?.contact_phone as string | null | undefined;
      const toE164 = normalizePhoneToE164(contactPhone);
      const useEvolution =
        String(row?.inbox_provider || "").toUpperCase() === "EVOLUTION" &&
        row?.evolution_instance_name &&
        row?.evolution_server_url &&
        row?.evolution_api_key;

      let replyToWhatsappMessageId: string | null = null;
      let evolutionQuotedContext: ReturnType<typeof resolveQuotedMessageContext>["evolutionQuoted"] = null;
      if (replyTo?.messageId) {
        const refRes = await pool.query(
          `
            SELECT metadata, sender_type, body, provider_message_id
            FROM pendencias.crm_messages
            WHERE id = $1::uuid
            LIMIT 1
          `,
          [String(replyTo.messageId)]
        );
        const refRow = refRes.rows?.[0];
        const resolved = resolveQuotedMessageContext(refRow, toE164);
        replyToWhatsappMessageId = resolved.metaQuotedId;
        evolutionQuotedContext = resolved.evolutionQuoted;
      }

      if (!toE164) {
        outboundWhatsApp.delivered = false;
        outboundWhatsApp.error = "Lead sem telefone válido para envio WhatsApp";
      } else if (useEvolution) {
        let finalResp: any = null;
        let finalOk = true;
        if (attachments.length > 0) {
          outboundWhatsApp.error =
            "Anexos pelo painel nesta linha Web: em breve — por enquanto envie pelo WhatsApp no celular.";
          finalOk = false;
        }
        if (signedText && finalOk) {
          const waResp = await evolutionSendText({
            serverUrl: String(row.evolution_server_url),
            apiKey: String(row.evolution_api_key),
            instanceName: String(row.evolution_instance_name),
            numberDigits: toE164,
            text: signedText,
            quotedContext: evolutionQuotedContext,
          });
          finalResp = waResp.response;
          finalOk = waResp.ok;
          if (!waResp.ok) outboundWhatsApp.error = waResp.error;
        }
        outboundWhatsApp.delivered = finalOk;
        outboundWhatsApp.response = finalResp;
      } else {
        let finalResp: any = null;
        let finalOk = true;
        if (signedText) {
          const waResp = await sendWhatsAppText({
            toE164,
            body: signedText,
            quotedMessageId: replyToWhatsappMessageId,
          });
          finalResp = waResp.response;
          finalOk = waResp.ok;
          if (!waResp.ok) outboundWhatsApp.error = waResp.error;
        }
        if (attachments.length > 0) {
          const first = attachments[0];
          const waAttResp = await sendWhatsAppAttachment({
            toE164,
            attachment: first,
            caption: signedText || undefined,
            quotedMessageId: replyToWhatsappMessageId,
          });
          finalResp = waAttResp.response || finalResp;
          finalOk = finalOk && waAttResp.ok;
          if (!waAttResp.ok) outboundWhatsApp.error = waAttResp.error;
        }
        outboundWhatsApp.delivered = finalOk;
        outboundWhatsApp.response = finalResp;
      }

      // Mescla outbound_whatsapp no metadata (preserva attachments etc.)
      const waMessageId = useEvolution
        ? outboundWhatsApp.response?.key?.id || null
        : outboundWhatsApp.response?.messages?.[0]?.id || null;
      await pool.query(
        `
          UPDATE pendencias.crm_messages
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
          WHERE id = $1
        `,
        [
          createdMessageId,
          JSON.stringify({
            outbound_whatsapp: {
              attempted: outboundWhatsApp.attempted,
              delivered: outboundWhatsApp.delivered,
              status: outboundWhatsApp.delivered ? "sent" : "failed",
              message_id: waMessageId,
              remote_jid: toE164 ? `${toE164}@s.whatsapp.net` : null,
              error: outboundWhatsApp.error || null,
            },
          }),
        ]
      );

      if (!outboundWhatsApp.delivered && !useEvolution) {
        await pool.query(
          `
            INSERT INTO pendencias.crm_outbox (
              message_id, conversation_id, channel, payload, status, attempts, last_error, next_attempt_at, created_at, updated_at
            )
            VALUES (
              $1, $2, 'WHATSAPP', $3::jsonb, 'PENDING', 1, $4, NOW() + INTERVAL '30 seconds', NOW(), NOW()
            )
          `,
          [
            createdMessageId,
            activeConversationId,
            JSON.stringify({
              body: text,
              senderType: dbSender,
            }),
            outboundWhatsApp.error || "Falha no envio WhatsApp",
          ]
        );
      }
      if (!outboundWhatsApp.delivered && useEvolution) {
        await pool.query(
          `
            INSERT INTO pendencias.crm_outbox (
              message_id, conversation_id, channel, payload, status, attempts, last_error, next_attempt_at, created_at, updated_at
            )
            VALUES (
              $1, $2, 'WHATSAPP_EVOLUTION', $3::jsonb, 'PENDING', 1, $4, NOW() + INTERVAL '20 seconds', NOW(), NOW()
            )
          `,
          [
            createdMessageId,
            activeConversationId,
            JSON.stringify({
              body: signedText || text,
              toE164,
              replyToWhatsappMessageId,
              evolutionQuoted: evolutionQuotedContext,
              evolution: {
                instanceName: String(row.evolution_instance_name),
                serverUrl: String(row.evolution_server_url),
                apiKey: String(row.evolution_api_key),
              },
            }),
            outboundWhatsApp.error || "Falha no envio Evolution",
          ]
        );
      }
    }

    // Log de atividade (para aparecer no drawer quando abrirmos fase 2)
    try {
      const leadRes = await pool.query(
        "SELECT lead_id FROM pendencias.crm_conversations WHERE id = $1",
        [activeConversationId]
      );
      const lead_id = leadRes.rows?.[0]?.lead_id;
      if (lead_id) {
        await pool.query(
          `
            INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
            VALUES ($1, $2, 'EVENT', $3, '{}'::jsonb, NOW())
          `,
          [
            lead_id,
            body?.senderUsername != null ? String(body.senderUsername) : null,
            `Mensagem enviada: ${(text || "[Anexo]").slice(0, 120)}${(text || "").length > 120 ? "..." : ""}`,
          ]
        );
      }
    } catch {
      // não bloqueia send em caso de log falhar
    }

    return NextResponse.json({
      success: true,
      conversationId: activeConversationId,
      channel: activeChannel,
      outboundWhatsApp,
      message: {
        id: createdMessageId,
        from: mapSenderFromDb(dbSender),
        text: text || "[Anexo]",
        time: formatTime(new Date()),
      },
    });
  } catch (error) {
    console.error("CRM messages POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const session = await getSessionContext(req);
    if (!session || !can(session, "crm.messages.delete")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const conversationId = searchParams.get("conversationId");
    const deleteInWhatsapp = searchParams.get("deleteInWhatsapp") !== "false";
    if (!messageId || !conversationId) {
      return NextResponse.json({ error: "messageId e conversationId obrigatórios" }, { status: 400 });
    }
    let whatsappDelete: {
      attempted: boolean;
      ok: boolean;
      error?: string | null;
      response?: any;
    } = { attempted: false, ok: false, error: null, response: null };

    const messageRes = await pool.query(
      `
        SELECT
          m.metadata,
          c.lead_id,
          c.whatsapp_inbox_id,
          i.provider AS inbox_provider,
          i.evolution_instance_name,
          i.evolution_server_url,
          i.evolution_api_key
        FROM pendencias.crm_messages m
        JOIN pendencias.crm_conversations c ON c.id = m.conversation_id
        LEFT JOIN pendencias.crm_whatsapp_inboxes i ON i.id = c.whatsapp_inbox_id
        WHERE m.id = $1::uuid
          AND m.conversation_id = $2::uuid
        LIMIT 1
      `,
      [messageId, conversationId]
    );
    const row = messageRes.rows?.[0];
    if (!row?.lead_id || !(await sessionCanAccessLead(pool, session, String(row.lead_id)))) {
      return NextResponse.json({ error: "Sem acesso a esta conversa" }, { status: 403 });
    }
    const meta = safeJsonParse(row?.metadata);
    const outbound = safeJsonParse(meta?.outbound_whatsapp);
    const messageWaId = String(outbound?.message_id || meta?.message_id || "").trim();
    const remoteJid = String(outbound?.remote_jid || meta?.remote_jid || "").trim();
    const fromMe = meta?.from_me === true || outbound?.from_me === true || Boolean(outbound?.message_id);
    const useEvolution =
      String(row?.inbox_provider || "").toUpperCase() === "EVOLUTION" &&
      row?.evolution_instance_name &&
      row?.evolution_server_url &&
      row?.evolution_api_key;

    if (deleteInWhatsapp && useEvolution && messageWaId && remoteJid && fromMe) {
      whatsappDelete.attempted = true;
      const wa = await evolutionDeleteMessageForEveryone({
        serverUrl: String(row.evolution_server_url),
        apiKey: String(row.evolution_api_key),
        instanceName: String(row.evolution_instance_name),
        messageId: messageWaId,
        remoteJid,
        fromMe: true,
      });
      whatsappDelete.ok = wa.ok;
      whatsappDelete.error = wa.error;
      whatsappDelete.response = wa.response;
    }
    if (
      deleteInWhatsapp &&
      !whatsappDelete.attempted &&
      String(row?.inbox_provider || "").toUpperCase() === "META"
    ) {
      whatsappDelete = {
        attempted: true,
        ok: false,
        error:
          "WhatsApp Cloud API (Meta) não oferece endpoint para apagar mensagem no aparelho do cliente; exclusão aplicada só no CRM.",
        response: null,
      };
    }
    const patch = {
      deleted_at: new Date().toISOString(),
      deleted_by: "operator",
      whatsapp_delete: whatsappDelete,
    };
    const res = await pool.query(
      `
        UPDATE pendencias.crm_messages
        SET body = '[Mensagem removida pelo atendente]',
            metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
        WHERE id = $2::uuid
          AND conversation_id = $3::uuid
        RETURNING id
      `,
      [JSON.stringify(patch), messageId, conversationId]
    );
    if (!res.rows?.[0]?.id) {
      return NextResponse.json({ error: "mensagem não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ success: true, whatsappDelete });
  } catch (error) {
    console.error("CRM messages DELETE error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

