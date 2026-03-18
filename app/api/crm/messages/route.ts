import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

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

    const messages = (result.rows || []).map((r: any) => ({
      id: r.id as string,
      from: mapSenderFromDb(r.sender_type),
      text: String(r.body || ""),
      time: formatTime(r.created_at ? new Date(r.created_at) : null),
      channel: String(r.channel || "WHATSAPP") as any,
    }));

    return NextResponse.json({ messages });
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
    if (!text) return NextResponse.json({ error: "body obrigatório" }, { status: 400 });

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
        VALUES ($1, $2, $3, false, '{}'::jsonb, NOW())
        RETURNING id, created_at
      `,
      [activeConversationId, dbSender, text]
    );

    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET last_message_at = NOW()
        WHERE id = $1
      `,
      [activeConversationId]
    );

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
            `Mensagem enviada: ${text.slice(0, 120)}${text.length > 120 ? "..." : ""}`,
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
      message: {
        id: messageInsert.rows?.[0]?.id as string,
        from: mapSenderFromDb(dbSender),
        text,
        time: formatTime(new Date()),
      },
    });
  } catch (error) {
    console.error("CRM messages POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

