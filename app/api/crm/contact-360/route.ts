import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import {
  filterLeadIdsVisibleInCrm,
  normalizeEmail,
  normalizePhoneLast10,
  resolveCrmListScope,
} from "../../../../lib/server/crmAccess";
import { bumpApiRoute } from "../../../../lib/server/apiHitMeter";
import { readThroughCache } from "../../../../lib/server/readThroughCache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, [
      "module.crm.view",
      "VIEW_CRM_CHAT",
      "VIEW_CRM_FUNIL",
      "VIEW_CRM_DASHBOARD",
    ]);
    if (guard.denied) return guard.denied;
    const session = guard.session!;

    await ensureCrmSchemaTables();
    const pool = getPool();
    const url = new URL(req.url);
    const phone10 = normalizePhoneLast10(url.searchParams.get("phone"));
    const email = normalizeEmail(url.searchParams.get("email"));
    const leadId = url.searchParams.get("leadId")?.trim() || null;

    if (!phone10 && !email && !leadId) {
      return NextResponse.json(
        { error: "Informe phone, email ou leadId" },
        { status: 400 }
      );
    }

    const matchRes = await pool.query(
      `
      SELECT DISTINCT l.id::text AS id
      FROM pendencias.crm_leads l
      WHERE
        ($1::uuid IS NOT NULL AND l.id = $1::uuid)
        OR ($2::text IS NOT NULL AND RIGHT(REGEXP_REPLACE(COALESCE(l.contact_phone,''), '\\D', '', 'g'), 10) = $2)
        OR ($3::text IS NOT NULL AND LOWER(TRIM(COALESCE(l.contact_email,''))) = $3)
      LIMIT 80
    `,
      [leadId, phone10, email]
    );

    const rawIds = (matchRes.rows || []).map((r: any) => String(r.id));
    const ctx = await resolveCrmListScope(session);
    const visibleIds = await filterLeadIdsVisibleInCrm(pool, rawIds, ctx, null);

    if (!visibleIds.length) {
      return NextResponse.json({
        phoneLast10: phone10,
        emailNormalized: email,
        leads: [],
        conversations: [],
        timeline: [],
        tasks: [],
        prefs: null,
        consentEvents: [],
      });
    }

    bumpApiRoute("GET /api/crm/contact-360");
    const c360Key = `crm:contact-360:${session.username}:${visibleIds.slice().sort().join(",")}`;

    const payload = await readThroughCache(c360Key, 5000, async () => {
    const poolInner = getPool();
    const [leads, conversations, timeline, tasks, prefs, events] = await Promise.all([
      poolInner.query(
        `
        SELECT
          l.id, l.title, l.contact_phone, l.contact_email,
          l.cte_number, l.cte_serie, l.protocol_number,
          l.priority, l.customer_status, l.source,
          l.assigned_username, l.owner_username, l.updated_at,
          s.name AS stage_name
        FROM pendencias.crm_leads l
        LEFT JOIN pendencias.crm_stages s ON s.id = l.stage_id
        WHERE l.id = ANY($1::uuid[])
        ORDER BY l.updated_at DESC
      `,
        [visibleIds]
      ),
      pool.query(
        `
        SELECT
          c.id, c.lead_id, c.channel, c.status,
          c.assigned_username, c.sla_breached_at, c.last_message_at,
          c.created_at, c.updated_at
        FROM pendencias.crm_conversations c
        WHERE c.lead_id = ANY($1::uuid[])
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT 40
      `,
        [visibleIds]
      ),
      pool.query(
        `
        SELECT
          m.id, m.conversation_id, c.lead_id, m.sender_type,
          LEFT(COALESCE(m.body,''), 500) AS body, m.created_at
        FROM pendencias.crm_messages m
        INNER JOIN pendencias.crm_conversations c ON c.id = m.conversation_id
        WHERE c.lead_id = ANY($1::uuid[])
        ORDER BY m.created_at DESC
        LIMIT 120
      `,
        [visibleIds]
      ),
      pool.query(
        `
        SELECT id, title, status, due_at, assigned_username, lead_id, conversation_id, created_at
        FROM pendencias.crm_tasks
        WHERE lead_id = ANY($1::uuid[])
        ORDER BY due_at NULLS LAST, created_at DESC
        LIMIT 80
      `,
        [visibleIds]
      ),
      pool.query(
        `
        SELECT id, phone_last10, email_normalized,
               allow_whatsapp_marketing, allow_campaigns, notes, updated_by, updated_at
        FROM pendencias.crm_contact_prefs
        WHERE ($1::text IS NOT NULL AND phone_last10 = $1)
           OR ($2::text IS NOT NULL AND email_normalized = $2)
        LIMIT 1
      `,
        [phone10, email]
      ),
      pool.query(
        `
        SELECT id, phone_last10, email_normalized, lead_id, event_type, reason, actor_username, created_at
        FROM pendencias.crm_consent_events
        WHERE ($1::text IS NOT NULL AND phone_last10 = $1)
           OR ($2::text IS NOT NULL AND email_normalized = $2)
           OR lead_id = ANY($3::uuid[])
        ORDER BY created_at DESC
        LIMIT 80
      `,
        [phone10, email, visibleIds]
      ),
    ]);

    return {
      phoneLast10: phone10,
      emailNormalized: email,
      leads: leads.rows || [],
      conversations: conversations.rows || [],
      timeline: timeline.rows || [],
      tasks: tasks.rows || [],
      prefs: prefs.rows?.[0] || null,
      consentEvents: events.rows || [],
    };
    });

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[crm.contact360]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
