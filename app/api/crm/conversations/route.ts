import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

function formatLastAt(d: Date | null | undefined) {
  if (!d) return "--";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    const result = await pool.query(
      `
        SELECT
          c.id,
          c.channel,
          c.last_message_at,
          l.id AS lead_id,
          l.title AS lead_name,
          l.contact_phone,
          l.contact_email,
          l.cte_number,
          l.cte_serie,
          l.priority,
          COALESCE(
            lm.body,
            CONCAT(
              'CTE ',
              COALESCE(l.cte_number, '—'),
              ' • ',
              COALESCE(l.contact_phone, l.contact_email, 'Sem contato')
            )
          ) AS last_message_body,
          lm.created_at AS last_message_at
        FROM pendencias.crm_conversations c
        JOIN pendencias.crm_leads l ON l.id = c.lead_id
        LEFT JOIN LATERAL (
          SELECT m.body, m.created_at
          FROM pendencias.crm_messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) lm ON true
        WHERE ($1::uuid IS NULL OR c.lead_id = $1)
        ORDER BY COALESCE(lm.created_at, c.last_message_at) DESC NULLS LAST
        LIMIT 50
      `,
      [leadId || null]
    );

    const conversations = (result.rows || []).map((r: any) => {
      const channel = String(r.channel || "WHATSAPP");
      const priority = String(r.priority || "MEDIA");
      const lastAt = formatLastAt(r.last_message_at ? new Date(r.last_message_at) : null);
      return {
        id: r.id as string,
        channel: channel as any,
        priority: priority as any,
        leadId: r.lead_id as string,
        leadName: r.lead_name as string,
        leadPhone: r.contact_phone as string | null,
        leadEmail: r.contact_email as string | null,
        cte: r.cte_number as string | null,
        cteSerie: r.cte_serie as string | null,
        lastMessage: r.last_message_body ? String(r.last_message_body) : "Sem mensagens ainda.",
        lastAt,
        unread: 0,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("CRM conversations GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId ? String(body.leadId) : null;
    const channel = body?.channel ? String(body.channel).toUpperCase() : "WHATSAPP";

    if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });

    if (!["WHATSAPP", "IA", "INTERNO"].includes(channel)) {
      return NextResponse.json({ error: "channel inválido" }, { status: 400 });
    }

    const existing = await pool.query(
      `
        SELECT id
        FROM pendencias.crm_conversations
        WHERE lead_id = $1 AND channel = $2 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [leadId, channel]
    );

    if (existing.rows?.[0]?.id) {
      return NextResponse.json({ conversationId: existing.rows[0].id });
    }

    const created = await pool.query(
      `
        INSERT INTO pendencias.crm_conversations (lead_id, channel, is_active, created_at, last_message_at)
        VALUES ($1, $2, true, NOW(), NULL)
        RETURNING id
      `,
      [leadId, channel]
    );

    return NextResponse.json({ conversationId: created.rows?.[0]?.id });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

