import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { evolutionSendText } from "../../../../lib/server/evolutionClient";

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
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

function normalizePhoneToE164(phoneRaw: string | null | undefined) {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return null;
  // Regras simples BR para início de operação:
  // - se já vier com DDI 55, mantém
  // - caso contrário, prefixa 55
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

async function sendWhatsAppText(args: { toE164: string; body: string }) {
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
        "SELECT channel FROM pendencias.crm_conversations WHERE id = $1",
        [activeConversationId]
      );
      activeChannel = convRes.rows?.[0]?.channel ? String(convRes.rows[0].channel) : activeChannel;
    }

    const dbSender = mapSenderToDb(senderType);
    const messageInsert = await pool.query(
      `
        INSERT INTO pendencias.crm_messages (conversation_id, sender_type, body, has_attachments, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
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
        if (text && finalOk) {
          const waResp = await evolutionSendText({
            serverUrl: String(row.evolution_server_url),
            apiKey: String(row.evolution_api_key),
            instanceName: String(row.evolution_instance_name),
            numberDigits: toE164,
            text,
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
        if (text) {
          const waResp = await sendWhatsAppText({ toE164, body: text });
          finalResp = waResp.response;
          finalOk = waResp.ok;
          if (!waResp.ok) outboundWhatsApp.error = waResp.error;
        }
        if (attachments.length > 0) {
          const first = attachments[0];
          const waAttResp = await sendWhatsAppAttachment({
            toE164,
            attachment: first,
            caption: text || undefined,
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
              error: outboundWhatsApp.error || null,
            },
          }),
        ]
      );

      // Retry outbox só para Cloud API (Meta). Evolution usa outro transporte.
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
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const conversationId = searchParams.get("conversationId");
    if (!messageId || !conversationId) {
      return NextResponse.json({ error: "messageId e conversationId obrigatórios" }, { status: 400 });
    }
    const patch = {
      deleted_at: new Date().toISOString(),
      deleted_by: "operator",
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
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM messages DELETE error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

