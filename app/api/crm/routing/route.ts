import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { classifyLeadTopic, pickFallbackAgent, resolveRoutingByRules } from "../../../../lib/server/crmRouting";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const rulesRes = await pool.query(
      `
        SELECT
          r.id, r.name, r.priority, r.is_active, r.match_type, r.match_value,
          r.target_type, r.target_team_id, r.target_username, r.target_stage_id,
          t.name AS team_name
        FROM pendencias.crm_routing_rules r
        LEFT JOIN pendencias.crm_teams t ON t.id = r.target_team_id
        ORDER BY r.priority ASC, r.created_at ASC
      `
    );
    return NextResponse.json({
      rules: (rulesRes.rows || []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        priority: Number(r.priority || 100),
        isActive: !!r.is_active,
        matchType: String(r.match_type || "TOPIC"),
        matchValue: String(r.match_value || ""),
        targetType: String(r.target_type || "NONE"),
        targetTeamId: r.target_team_id ? String(r.target_team_id) : null,
        targetTeamName: r.team_name ? String(r.team_name) : null,
        targetUsername: r.target_username ? String(r.target_username) : null,
        targetStageId: r.target_stage_id ? String(r.target_stage_id) : null,
      })),
    });
  } catch (error) {
    console.error("CRM routing GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = body?.action ? String(body.action).toUpperCase() : "SUGGEST";

    if (action === "UPSERT_RULE") {
      const id = body?.id ? String(body.id) : null;
      const payload = {
        name: String(body?.name || "Regra sem nome"),
        priority: Number(body?.priority || 100),
        isActive: body?.isActive === undefined ? true : !!body.isActive,
        matchType: String(body?.matchType || "TOPIC").toUpperCase(),
        matchValue: String(body?.matchValue || ""),
        targetType: String(body?.targetType || "NONE").toUpperCase(),
        targetTeamId: body?.targetTeamId ? String(body.targetTeamId) : null,
        targetUsername: body?.targetUsername ? String(body.targetUsername) : null,
        targetStageId: body?.targetStageId ? String(body.targetStageId) : null,
        createdBy: body?.createdBy ? String(body.createdBy) : null,
      };

      if (!id) {
        const inserted = await pool.query(
          `
            INSERT INTO pendencias.crm_routing_rules (
              name, priority, is_active, match_type, match_value,
              target_type, target_team_id, target_username, target_stage_id, created_by, created_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
            RETURNING id
          `,
          [
            payload.name,
            payload.priority,
            payload.isActive,
            payload.matchType,
            payload.matchValue,
            payload.targetType,
            payload.targetTeamId,
            payload.targetUsername,
            payload.targetStageId,
            payload.createdBy,
          ]
        );
        return NextResponse.json({ id: inserted.rows?.[0]?.id, success: true });
      }

      await pool.query(
        `
          UPDATE pendencias.crm_routing_rules
          SET
            name = $2,
            priority = $3,
            is_active = $4,
            match_type = $5,
            match_value = $6,
            target_type = $7,
            target_team_id = $8,
            target_username = $9,
            target_stage_id = $10,
            updated_at = NOW()
          WHERE id = $1
        `,
        [id, payload.name, payload.priority, payload.isActive, payload.matchType, payload.matchValue, payload.targetType, payload.targetTeamId, payload.targetUsername, payload.targetStageId]
      );
      return NextResponse.json({ id, success: true });
    }

    // default: suggest routing
    const text = body?.text != null ? String(body.text) : null;
    const title = body?.title != null ? String(body.title) : null;
    const cte = body?.cte != null ? String(body.cte) : null;
    const conversationId = body?.conversationId != null ? String(body.conversationId) : "";
    const topic = classifyLeadTopic({ text, title, cte });
    const byRules = await resolveRoutingByRules({ text, title, cte, leadId: body?.leadId ? String(body.leadId) : null });
    const fallbackAgent = conversationId ? await pickFallbackAgent(conversationId) : null;

    return NextResponse.json({
      topic,
      routing: {
        source: byRules.source,
        targetType: byRules.targetType,
        targetUsername: byRules.targetUsername,
        targetTeamId: byRules.targetTeamId,
        targetStageId: byRules.targetStageId,
        fallbackAgent,
      },
    });
  } catch (error) {
    console.error("CRM routing POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

