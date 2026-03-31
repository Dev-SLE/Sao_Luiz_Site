import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { ensureDefaultPipelineAndFirstStage } from "../../../../lib/server/crmDefaultPipeline";

export const runtime = "nodejs";

function onlyDigits(v: string | null | undefined) {
  return String(v || "").replace(/\D/g, "");
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") || 50)));
    const rows = await pool.query(
      `
        SELECT
          b.id,
          b.inbox_id,
          wi.name AS inbox_name,
          b.phone_last10,
          b.phone_digits,
          b.profile_name,
          b.message_count,
          b.sample_text,
          b.business_score,
          b.last_decision,
          b.first_seen_at,
          b.last_seen_at,
          b.created_lead_id
        FROM pendencias.crm_evolution_intake_buffer b
        LEFT JOIN pendencias.crm_whatsapp_inboxes wi ON wi.id = b.inbox_id
        WHERE b.created_lead_id IS NULL
        ORDER BY b.last_seen_at DESC
        LIMIT $1
      `,
      [limit]
    );
    return NextResponse.json({
      items: (rows.rows || []).map((r: any) => ({
        id: String(r.id),
        inboxId: String(r.inbox_id),
        inboxName: r.inbox_name ? String(r.inbox_name) : null,
        phoneLast10: String(r.phone_last10 || ""),
        phoneDigits: String(r.phone_digits || ""),
        profileName: r.profile_name ? String(r.profile_name) : null,
        messageCount: Number(r.message_count || 0),
        sampleText: String(r.sample_text || ""),
        businessScore: Number(r.business_score || 0),
        lastDecision: String(r.last_decision || "WAIT"),
        firstSeenAt: r.first_seen_at || null,
        lastSeenAt: r.last_seen_at || null,
      })),
    });
  } catch (error) {
    console.error("evolution-intake-buffer GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();
    const bufferId = String(body?.bufferId || "").trim();
    const actor = body?.actor ? String(body.actor) : null;
    if (!bufferId) return NextResponse.json({ error: "bufferId obrigatório" }, { status: 400 });
    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    const br = await pool.query(
      `
        SELECT id, inbox_id, phone_last10, phone_digits, profile_name, sample_text
        FROM pendencias.crm_evolution_intake_buffer
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [bufferId]
    );
    const row = br.rows?.[0];
    if (!row?.id) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    if (action === "REJECT") {
      await pool.query(`DELETE FROM pendencias.crm_evolution_intake_buffer WHERE id = $1::uuid`, [bufferId]);
      await pool.query(
        `
          INSERT INTO pendencias.app_logs (level, source, event, username, payload)
          VALUES ('INFO','crm','CRM_INTAKE_REJECT',$1,$2::jsonb)
        `,
        [actor, JSON.stringify({ bufferId, phoneLast10: row.phone_last10 })]
      );
      return NextResponse.json({ success: true, action });
    }

    const defaultIds = await ensureDefaultPipelineAndFirstStage(pool);
    if (!defaultIds) {
      return NextResponse.json({ error: "Funil CRM não disponível" }, { status: 500 });
    }

    const phoneLast10 = String(row.phone_last10 || "");
    const exists = await pool.query(
      `
        SELECT id
        FROM pendencias.crm_leads
        WHERE contact_phone IS NOT NULL
          AND RIGHT(regexp_replace(contact_phone, '\\D', '', 'g'), 10) = $1
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [phoneLast10]
    );
    const existingId = exists.rows?.[0]?.id ? String(exists.rows[0].id) : null;
    let leadId = existingId;

    if (!leadId) {
      const positionRow = await pool.query(
        `
          SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
          FROM pendencias.crm_leads
          WHERE pipeline_id = $1 AND stage_id = $2
        `,
        [defaultIds.pipelineId, defaultIds.stageId]
      );
      const position = Number(positionRow.rows?.[0]?.next_pos || 0);
      const leadTitle = row.profile_name
        ? `${String(row.profile_name)} (${phoneLast10})`
        : `WhatsApp ${phoneLast10}`;
      const ins = await pool.query(
        `
          INSERT INTO pendencias.crm_leads (
            pipeline_id, stage_id, title, contact_phone, source, priority, position, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,'WHATSAPP_WEB','MEDIA',$5,NOW(),NOW())
          RETURNING id
        `,
        [defaultIds.pipelineId, defaultIds.stageId, leadTitle, onlyDigits(row.phone_digits), position]
      );
      leadId = String(ins.rows?.[0]?.id);
      await pool.query(
        `
          INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
          VALUES ($1::uuid, $2, 'EVENT', 'Lead aprovado manualmente na triagem', $3::jsonb, NOW())
        `,
        [leadId, actor, JSON.stringify({ bufferId, sampleText: String(row.sample_text || "").slice(0, 600) })]
      );
    }

    await pool.query(
      `
        UPDATE pendencias.crm_evolution_intake_buffer
        SET last_decision = 'APPROVED', created_lead_id = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [bufferId, leadId]
    );
    await pool.query(
      `
        INSERT INTO pendencias.app_logs (level, source, event, username, payload)
        VALUES ('INFO','crm','CRM_INTAKE_APPROVE',$1,$2::jsonb)
      `,
      [actor, JSON.stringify({ bufferId, leadId, phoneLast10: row.phone_last10 })]
    );
    return NextResponse.json({ success: true, action, leadId });
  } catch (error) {
    console.error("evolution-intake-buffer POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
