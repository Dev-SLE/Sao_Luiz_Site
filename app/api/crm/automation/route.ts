import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const [cadences, campaigns] = await Promise.all([
      pool.query(
        `
        SELECT c.id, c.name, c.is_active, c.stage_id, s.name AS stage_name,
               c.trigger_after_minutes, c.message_template, c.updated_at
        FROM pendencias.crm_cadences c
        LEFT JOIN pendencias.crm_stages s ON s.id = c.stage_id
        ORDER BY c.updated_at DESC
      `
      ),
      pool.query(
        `
        SELECT id, name, status, require_opt_in, message_template, audience_filter, created_at, updated_at
        FROM pendencias.crm_campaigns
        ORDER BY updated_at DESC
      `
      ),
    ]);
    return NextResponse.json({
      cadences: cadences.rows || [],
      campaigns: campaigns.rows || [],
    });
  } catch (error) {
    console.error("[crm.automation.get]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();
    const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const actor = guard.session?.username || null;

    if (action === "UPSERT_CADENCE") {
      const id = body?.id ? String(body.id) : null;
      const name = String(body?.name || "").trim();
      const messageTemplate = String(body?.messageTemplate || "").trim();
      const triggerAfterMinutes = Math.max(5, Number(body?.triggerAfterMinutes || 1440));
      const stageId = body?.stageId ? String(body.stageId) : null;
      const isActive = body?.isActive === undefined ? true : !!body.isActive;
      if (!name || !messageTemplate) {
        return NextResponse.json({ error: "name e messageTemplate são obrigatórios" }, { status: 400 });
      }
      if (!id) {
        const ins = await pool.query(
          `
            INSERT INTO pendencias.crm_cadences
              (name, is_active, stage_id, trigger_after_minutes, message_template, created_by, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
            RETURNING id
          `,
          [name, isActive, stageId, triggerAfterMinutes, messageTemplate, actor]
        );
        return NextResponse.json({ success: true, id: ins.rows?.[0]?.id || null });
      }
      await pool.query(
        `
          UPDATE pendencias.crm_cadences
          SET name = $2,
              is_active = $3,
              stage_id = $4,
              trigger_after_minutes = $5,
              message_template = $6,
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [id, name, isActive, stageId, triggerAfterMinutes, messageTemplate]
      );
      return NextResponse.json({ success: true, id });
    }

    if (action === "UPSERT_CAMPAIGN") {
      const id = body?.id ? String(body.id) : null;
      const name = String(body?.name || "").trim();
      const messageTemplate = String(body?.messageTemplate || "").trim();
      const requireOptIn = body?.requireOptIn === undefined ? true : !!body.requireOptIn;
      const status = String(body?.status || "DRAFT").toUpperCase();
      const audienceFilter = body?.audienceFilter && typeof body.audienceFilter === "object" ? body.audienceFilter : {};
      if (!name || !messageTemplate) {
        return NextResponse.json({ error: "name e messageTemplate são obrigatórios" }, { status: 400 });
      }
      if (!id) {
        const ins = await pool.query(
          `
            INSERT INTO pendencias.crm_campaigns
              (name, audience_filter, message_template, require_opt_in, status, created_by, created_at, updated_at)
            VALUES ($1,$2::jsonb,$3,$4,$5,$6,NOW(),NOW())
            RETURNING id
          `,
          [name, JSON.stringify(audienceFilter), messageTemplate, requireOptIn, status, actor]
        );
        return NextResponse.json({ success: true, id: ins.rows?.[0]?.id || null });
      }
      await pool.query(
        `
          UPDATE pendencias.crm_campaigns
          SET name = $2,
              audience_filter = $3::jsonb,
              message_template = $4,
              require_opt_in = $5,
              status = $6,
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [id, name, JSON.stringify(audienceFilter), messageTemplate, requireOptIn, status]
      );
      return NextResponse.json({ success: true, id });
    }

    if (action === "QUEUE_CAMPAIGN") {
      const campaignId = String(body?.campaignId || "").trim();
      if (!campaignId) return NextResponse.json({ error: "campaignId obrigatório" }, { status: 400 });
      const campaignRes = await pool.query(
        `SELECT id, message_template, require_opt_in, audience_filter FROM pendencias.crm_campaigns WHERE id = $1::uuid LIMIT 1`,
        [campaignId]
      );
      const campaign = campaignRes.rows?.[0];
      if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
      const af = campaign.audience_filter || {};
      const stageId = af?.stageId ? String(af.stageId) : null;
      const priority = af?.priority ? String(af.priority).toUpperCase() : null;
      const limit = Math.max(1, Math.min(500, Number(body?.limit || af?.limit || 100)));

      const leads = await pool.query(
        `
          SELECT l.id AS lead_id,
                 c.id AS conversation_id,
                 l.contact_phone,
                 (COALESCE(l.observations,'') ILIKE '%optin%') AS opted_in
          FROM pendencias.crm_leads l
          LEFT JOIN pendencias.crm_conversations c ON c.lead_id = l.id AND c.channel = 'WHATSAPP' AND c.is_active = true
          WHERE ($1::uuid IS NULL OR l.stage_id = $1::uuid)
            AND ($2::text IS NULL OR UPPER(COALESCE(l.priority,'MEDIA')) = $2::text)
            AND NOT EXISTS (
              SELECT 1 FROM pendencias.crm_contact_prefs p
              WHERE p.allow_campaigns = false
                AND (
                  p.phone_last10 = RIGHT(REGEXP_REPLACE(COALESCE(l.contact_phone,''), '\\D', '', 'g'), 10)
                  OR (
                    COALESCE(l.contact_email,'') <> ''
                    AND p.email_normalized = LOWER(TRIM(COALESCE(l.contact_email,'')))
                  )
                )
            )
          ORDER BY l.updated_at DESC
          LIMIT $3
        `,
        [stageId, priority, limit]
      );

      let queued = 0;
      for (const row of leads.rows || []) {
        const optedIn = !!row.opted_in;
        if (campaign.require_opt_in && !optedIn) continue;
        await pool.query(
          `
            INSERT INTO pendencias.crm_campaign_dispatches
              (campaign_id, lead_id, conversation_id, opted_in, status, created_at)
            VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'PENDING',NOW())
            ON CONFLICT (campaign_id, lead_id) DO NOTHING
          `,
          [campaignId, row.lead_id, row.conversation_id || null, optedIn]
        );
        if (row.conversation_id) {
          await pool.query(
            `
              INSERT INTO pendencias.crm_outbox
                (conversation_id, channel, payload, status, attempts, next_attempt_at, created_at, updated_at)
              VALUES ($1::uuid, 'WHATSAPP', $2::jsonb, 'PENDING', 0, NOW(), NOW(), NOW())
            `,
            [row.conversation_id, JSON.stringify({ body: campaign.message_template, source: "campaign", campaignId })]
          );
          queued += 1;
        }
      }

      await pool.query(`UPDATE pendencias.crm_campaigns SET status = 'RUNNING', updated_at = NOW() WHERE id = $1::uuid`, [campaignId]);
      return NextResponse.json({ success: true, queued });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    console.error("[crm.automation.post]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
