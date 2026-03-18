import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId ? String(body.leadId) : null;
    const stageId = body?.stageId ? String(body.stageId) : null;
    if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
    if (!stageId) return NextResponse.json({ error: "stageId obrigatório" }, { status: 400 });

    const leadRes = await pool.query("SELECT pipeline_id FROM pendencias.crm_leads WHERE id = $1", [leadId]);
    const lead = leadRes.rows?.[0];
    if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

    const stageRes = await pool.query(
      "SELECT id, name, pipeline_id FROM pendencias.crm_stages WHERE id = $1",
      [stageId]
    );
    const stage = stageRes.rows?.[0];
    if (!stage) return NextResponse.json({ error: "stage não encontrado" }, { status: 404 });

    if (String(stage.pipeline_id) !== String(lead.pipeline_id)) {
      return NextResponse.json({ error: "stage não pertence ao pipeline do lead" }, { status: 400 });
    }

    const positionRow = await pool.query(
      `
        SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
        FROM pendencias.crm_leads
        WHERE pipeline_id = $1 AND stage_id = $2
      `,
      [lead.pipeline_id, stageId]
    );
    const nextPos = Number(positionRow.rows?.[0]?.next_pos || 0);

    await pool.query(
      `
        UPDATE pendencias.crm_leads
        SET stage_id = $1, position = $2, updated_at = NOW()
        WHERE id = $3
      `,
      [stageId, nextPos, leadId]
    );

    const activityUser = body?.ownerUsername != null ? String(body.ownerUsername) : null;
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, created_at)
        VALUES ($1, $2, 'EVENT', $3, NOW())
      `,
      [leadId, activityUser, `Lead movido para "${String(stage.name)}"`]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM leads move PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

