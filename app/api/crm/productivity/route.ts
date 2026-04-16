import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { bumpApiRoute } from "../../../../lib/server/apiHitMeter";
import { defaultCrmReadCacheTtlMs, readThroughCache } from "../../../../lib/server/readThroughCache";

export const runtime = "nodejs";

function parseDateRange(url: URL): { fromTs: string | null; toTs: string | null } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from && !to) return { fromTs: null, toTs: null };
  const fromTs = from ? `${from}T00:00:00.000Z` : null;
  const toTs = to ? `${to}T23:59:59.999Z` : null;
  return { fromTs, toTs };
}

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view", "VIEW_CRM_DASHBOARD"]);
    if (guard.denied) return guard.denied;
    bumpApiRoute("GET /api/crm/productivity");

    await ensureCrmSchemaTables();
    const url = new URL(req.url);
    const cacheKey = `crm:productivity:${url.searchParams.toString()}`;
    const ttl = defaultCrmReadCacheTtlMs();

    const payload = await readThroughCache(cacheKey, ttl, async () => {
    const pool = getPool();
    const { fromTs, toTs } = parseDateRange(url);
    const channel = url.searchParams.get("channel");
    const channelUpper = channel && channel.trim() ? String(channel).trim().toUpperCase() : null;
    const teamId = url.searchParams.get("teamId");
    const teamUuid = teamId && teamId.trim() ? String(teamId).trim() : null;

    const convFilter = `
      c.is_active = true
      AND ($1::text IS NULL OR UPPER(TRIM(COALESCE(c.channel,''))) = $1::text)
      AND ($2::uuid IS NULL OR c.assigned_team_id = $2::uuid)
    `;
    const convParams = [channelUpper, teamUuid];

    const [channelRes, teamRes, agentRes, slaRes, stageRes, teamOptionsRes] = await Promise.all([
      pool.query(
        `
          SELECT c.channel, COUNT(*)::int AS total
          FROM pendencias.crm_conversations c
          WHERE ${convFilter}
          GROUP BY c.channel
        `,
        convParams
      ),
      pool.query(
        `
          SELECT
            COALESCE(t.name, 'Sem time') AS team_name,
            COUNT(*)::int AS open_count
          FROM pendencias.crm_conversations c
          LEFT JOIN pendencias.crm_teams t ON t.id = c.assigned_team_id
          WHERE ${convFilter}
            AND c.status IN ('PENDENTE', 'EM_RASTREIO')
          GROUP BY COALESCE(t.name, 'Sem time')
          ORDER BY open_count DESC
        `,
        convParams
      ),
      pool.query(
        `
          SELECT
            COALESCE(c.assigned_username, 'Sem responsável') AS username,
            COUNT(*)::int AS open_count,
            COUNT(*) FILTER (WHERE c.sla_breached_at IS NOT NULL)::int AS sla_breached
          FROM pendencias.crm_conversations c
          WHERE ${convFilter}
          GROUP BY COALESCE(c.assigned_username, 'Sem responsável')
          ORDER BY open_count DESC
          LIMIT 20
        `,
        convParams
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE c.sla_due_at IS NOT NULL)::int AS tracked,
            COUNT(*) FILTER (WHERE c.sla_breached_at IS NOT NULL)::int AS breached
          FROM pendencias.crm_conversations c
          WHERE ${convFilter}
        `,
        convParams
      ),
      pool.query(
        `
          SELECT
            s.name AS stage_name,
            COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - l.updated_at)) / 60), 0)::int AS avg_minutes
          FROM pendencias.crm_stages s
          LEFT JOIN pendencias.crm_leads l ON l.stage_id = s.id
            AND ($3::timestamptz IS NULL OR l.updated_at >= $3::timestamptz)
            AND ($4::timestamptz IS NULL OR l.updated_at <= $4::timestamptz)
          GROUP BY s.name
          ORDER BY avg_minutes DESC
          LIMIT 12
        `,
        [...convParams, fromTs, toTs]
      ),
      pool.query(
        `
          SELECT id, name
          FROM pendencias.crm_teams
          WHERE is_active = true
          ORDER BY name ASC
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

    const teamOptions = (teamOptionsRes.rows || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
    }));

    return {
      filters: { from: fromTs ? url.searchParams.get("from") : null, to: toTs ? url.searchParams.get("to") : null, channel: channelUpper, teamId: teamUuid },
      channels,
      teams,
      teamOptions,
      agents,
      sla: { tracked, breached, hitRate: slaHitRate },
      stageTimes,
    };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("CRM productivity GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
