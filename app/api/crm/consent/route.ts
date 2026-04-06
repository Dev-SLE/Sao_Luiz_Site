import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import {
  normalizeEmail,
  normalizePhoneLast10,
  sessionCanAccessLead,
} from "../../../../lib/server/crmAccess";

export const runtime = "nodejs";

async function upsertPrefs(pool: any, args: {
  phone10: string | null;
  email: string | null;
  allowWhatsapp: boolean;
  allowCampaigns: boolean;
  notes: string | null;
  actor: string | null;
}) {
  const existing = await pool.query(
    `
    SELECT id FROM pendencias.crm_contact_prefs
    WHERE ($1::text IS NOT NULL AND phone_last10 = $1)
       OR ($2::text IS NOT NULL AND email_normalized = $2)
    LIMIT 1
  `,
    [args.phone10, args.email]
  );
  const row = existing.rows?.[0];
  if (row?.id) {
    await pool.query(
      `
      UPDATE pendencias.crm_contact_prefs SET
        allow_whatsapp_marketing = $2,
        allow_campaigns = $3,
        notes = COALESCE($4, notes),
        updated_by = $5,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      [row.id, args.allowWhatsapp, args.allowCampaigns, args.notes, args.actor]
    );
    return row.id;
  }
  const ins = await pool.query(
    `
    INSERT INTO pendencias.crm_contact_prefs
      (phone_last10, email_normalized, allow_whatsapp_marketing, allow_campaigns, notes, updated_by, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    RETURNING id
  `,
    [args.phone10, args.email, args.allowWhatsapp, args.allowCampaigns, args.notes, args.actor]
  );
  return ins.rows?.[0]?.id;
}

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || 100)));

    const [prefs, events] = await Promise.all([
      pool.query(
        `
        SELECT id, phone_last10, email_normalized,
               allow_whatsapp_marketing, allow_campaigns, notes, updated_by, updated_at
        FROM pendencias.crm_contact_prefs
        ORDER BY updated_at DESC
        LIMIT $1
      `,
        [limit]
      ),
      pool.query(
        `
        SELECT id, phone_last10, email_normalized, lead_id, event_type, reason, actor_username, created_at
        FROM pendencias.crm_consent_events
        ORDER BY created_at DESC
        LIMIT $1
      `,
        [limit]
      ),
    ]);

    return NextResponse.json({
      prefs: prefs.rows || [],
      events: events.rows || [],
    });
  } catch (e) {
    console.error("[crm.consent.get]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();
    const guardFull = await requireApiPermissions(req, ["MANAGE_CRM_OPS", "MANAGE_SETTINGS"]);

    if (action === "UPSERT_PREFS") {
      if (guardFull.denied) return guardFull.denied;
      const phone10 = normalizePhoneLast10(body?.phone);
      const email = normalizeEmail(body?.email);
      if (!phone10 && !email) {
        return NextResponse.json({ error: "phone ou email obrigatório" }, { status: 400 });
      }
      const allowWhatsapp = body?.allowWhatsappMarketing !== undefined ? !!body.allowWhatsappMarketing : true;
      const allowCampaigns = body?.allowCampaigns !== undefined ? !!body.allowCampaigns : true;
      const notes = body?.notes != null ? String(body.notes).slice(0, 2000) : null;
      const actor = guardFull.session?.username || null;
      await upsertPrefs(pool, {
        phone10,
        email,
        allowWhatsapp,
        allowCampaigns,
        notes,
        actor,
      });
      await pool.query(
        `
        INSERT INTO pendencias.crm_consent_events
          (phone_last10, email_normalized, lead_id, event_type, reason, payload, actor_username)
        VALUES ($1,$2,NULL,'PREFS_UPDATE',$3,$4::jsonb,$5)
      `,
        [
          phone10,
          email,
          notes,
          JSON.stringify({ allowWhatsappMarketing: allowWhatsapp, allowCampaigns }),
          actor,
        ]
      );
      return NextResponse.json({ success: true });
    }

    if (action === "RECORD_EVENT") {
      const guardChat = await requireApiPermissions(req, [
        "module.crm.view",
        "VIEW_CRM_CHAT",
        "VIEW_CRM_FUNIL",
        "VIEW_CRM_DASHBOARD",
      ]);
      if (guardChat.denied && guardFull.denied) return guardChat.denied;

      const eventType = String(body?.eventType || "OPT_OUT").toUpperCase();
      const reason = body?.reason != null ? String(body.reason).slice(0, 500) : null;
      const leadId = body?.leadId ? String(body.leadId) : null;
      let phone10 = normalizePhoneLast10(body?.phone);
      let email = normalizeEmail(body?.email);
      const session = guardChat.session || guardFull.session;
      const actor = session?.username || null;
      const isManager = !guardFull.denied;

      if (leadId) {
        const canSee =
          isManager ||
          (session ? await sessionCanAccessLead(pool, session, leadId) : false);
        if (!canSee) {
          return NextResponse.json({ error: "Sem permissão para este lead" }, { status: 403 });
        }
        const lr = await pool.query(
          `SELECT contact_phone, contact_email FROM pendencias.crm_leads WHERE id = $1::uuid LIMIT 1`,
          [leadId]
        );
        const row = lr.rows?.[0];
        if (row) {
          phone10 = phone10 || normalizePhoneLast10(row.contact_phone);
          email = email || normalizeEmail(row.contact_email);
        }
      } else if (!isManager) {
        return NextResponse.json({ error: "leadId obrigatório para atendentes" }, { status: 403 });
      }

      if (!phone10 && !email) {
        return NextResponse.json({ error: "Não foi possível identificar telefone ou e-mail" }, { status: 400 });
      }

      await pool.query(
        `
        INSERT INTO pendencias.crm_consent_events
          (phone_last10, email_normalized, lead_id, event_type, reason, payload, actor_username)
        VALUES ($1,$2,$3::uuid,$4,$5,$6::jsonb,$7)
      `,
        [phone10, email, leadId || null, eventType, reason, JSON.stringify({ source: "api" }), actor]
      );

      const allowCampaigns = eventType === "OPT_OUT" ? false : true;
      const allowWhatsapp = eventType === "OPT_OUT" ? false : true;
      await upsertPrefs(pool, {
        phone10,
        email,
        allowWhatsapp,
        allowCampaigns,
        notes: reason,
        actor,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[crm.consent.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
