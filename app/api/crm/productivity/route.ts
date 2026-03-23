import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const [channelRes, teamRes, agentRes, slaRes, stageRes] = await Promise.all([
      pool.query(
        `
          SELECT channel, COUNT(*)::int AS total
          FROM pendencias.crm_conversations
          WHERE is_active = true
          GROUP BY channel
        `
      ),
      pool.query(
        `
          SELECT
            COALESCE(t.name, 'Sem time') AS team_name,
            COUNT(*)::int AS open_count
          FROM pendencias.crm_conversations c
          LEFT JOIN pendencias.crm_teams t ON t.id = c.assigned_team_id
          WHERE c.is_active = true AND c.status IN ('PENDENTE', 'EM_RASTREIO')
          GROUP BY COALESCE(t.name, 'Sem time')
          ORDER BY open_count DESC
        `
      ),
      pool.query(
        `
          SELECT
            COALESCE(c.assigned_username, 'Sem responsável') AS username,
            COUNT(*)::int AS open_count,
            COUNT(*) FILTER (WHERE c.sla_breached_at IS NOT NULL)::int AS sla_breached
          FROM pendencias.crm_conversations c
          WHERE c.is_active = true
          GROUP BY COALESCE(c.assigned_username, 'Sem responsável')
          ORDER BY open_count DESC
          LIMIT 20
        `
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE sla_due_at IS NOT NULL)::int AS tracked,
            COUNT(*) FILTER (WHERE sla_breached_at IS NOT NULL)::int AS breached
          FROM pendencias.crm_conversations
          WHERE is_active = true
        `
      ),
      pool.query(
        `
          SELECT
            s.name AS stage_name,
            COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - l.updated_at)) / 60), 0)::int AS avg_minutes
          FROM pendencias.crm_stages s
          LEFT JOIN pendencias.crm_leads l ON l.stage_id = s.id
          GROUP BY s.name
          ORDER BY avg_minutes DESC
          LIMIT 12
        `
      ),
    ]);

    const channels = (channelRes.rows || []).map((r: any) => ({
      channel: String(r.channel || "WHATSAPP"),
      total: Number(r.total || 0),
    }));

    const teams = (teamRes.rows || []).map((r: any) => ({
      teamName: String(r.team_name || "Sem time"),
      openCount: Number(r.open_count || 0),
    }));

    const agents = (agentRes.rows || []).map((r: any) => ({
      username: String(r.username || "Sem responsável"),
      openCount: Number(r.open_count || 0),
      slaBreached: Number(r.sla_breached || 0),
    }));

    const tracked = Number(slaRes.rows?.[0]?.tracked || 0);
    const breached = Number(slaRes.rows?.[0]?.breached || 0);
    const slaHitRate = tracked > 0 ? Math.max(0, Math.round(((tracked - breached) / tracked) * 100)) : 100;

    const stageTimes = (stageRes.rows || []).map((r: any) => ({
      stage: String(r.stage_name || "Sem etapa"),
      minutes: Number(r.avg_minutes || 0),
    }));

    return NextResponse.json({
      channels,
      teams,
      agents,
      sla: { tracked, breached, hitRate: slaHitRate },
      stageTimes,
    });
  } catch (error) {
    console.error("CRM productivity GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

