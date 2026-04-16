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
    bumpApiRoute("GET /api/crm/executive-kpis");
    await ensureCrmSchemaTables();
    const url = new URL(req.url);
    const cacheKey = `crm:executive-kpis:${url.searchParams.toString()}`;
    const ttl = defaultCrmReadCacheTtlMs();

    const payload = await readThroughCache(cacheKey, ttl, async () => {
    const pool = getPool();
    const { fromTs, toTs } = parseDateRange(url);
    const channel = url.searchParams.get("channel");
    const channelUpper = channel && channel.trim() ? String(channel).trim().toUpperCase() : null;
    const teamId = url.searchParams.get("teamId");
    const teamUuid = teamId && teamId.trim() ? String(teamId).trim() : null;

    const [funnel, sla, channelAgg, productivity] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*)::int AS total_leads,
            COUNT(*) FILTER (WHERE UPPER(COALESCE(priority,'MEDIA'))='ALTA')::int AS alta_prioridade,
            COUNT(*) FILTER (WHERE UPPER(COALESCE(customer_status,'')) IN ('CONCLUIDO','FECHADO','GANHO'))::int AS convertidos
          FROM pendencias.crm_leads l
          WHERE ($1::timestamptz IS NULL OR l.updated_at >= $1::timestamptz)
            AND ($2::timestamptz IS NULL OR l.updated_at <= $2::timestamptz)
        `,
        [fromTs, toTs]
      ),
      pool.query(
        `
          SELECT
            COUNT(*)::int AS total_conversas,
            COUNT(*) FILTER (WHERE sla_breached_at IS NOT NULL)::int AS sla_estourado
          FROM pendencias.crm_conversations c
          WHERE c.is_active = true
            AND ($1::text IS NULL OR UPPER(TRIM(COALESCE(c.channel,''))) = $1::text)
            AND ($2::uuid IS NULL OR c.assigned_team_id = $2::uuid)
        `,
        [channelUpper, teamUuid]
      ),
      pool.query(
        `
          SELECT channel, COUNT(*)::int AS total
          FROM pendencias.crm_conversations c
          WHERE c.is_active = true
            AND ($1::text IS NULL OR UPPER(TRIM(COALESCE(c.channel,''))) = $1::text)
            AND ($2::uuid IS NULL OR c.assigned_team_id = $2::uuid)
          GROUP BY channel
        `,
        [channelUpper, teamUuid]
      ),
      pool.query(
        `
          SELECT COALESCE(c.assigned_username,'SEM_RESPONSAVEL') AS agente, COUNT(*)::int AS total
          FROM pendencias.crm_conversations c
          WHERE c.is_active = true
            AND ($1::text IS NULL OR UPPER(TRIM(COALESCE(c.channel,''))) = $1::text)
            AND ($2::uuid IS NULL OR c.assigned_team_id = $2::uuid)
          GROUP BY COALESCE(c.assigned_username,'SEM_RESPONSAVEL')
          ORDER BY total DESC
          LIMIT 10
        `,
        [channelUpper, teamUuid]
      ),
    ]);

    const f = funnel.rows?.[0] || {};
    const s = sla.rows?.[0] || {};
    const totalConvs = Number(s.total_conversas || 0);
    const breached = Number(s.sla_estourado || 0);
    const slaHitRate = totalConvs > 0 ? Math.max(0, ((totalConvs - breached) / totalConvs) * 100) : 100;

    return {
      generatedAt: new Date().toISOString(),
      filters: { from: fromTs ? url.searchParams.get("from") : null, to: toTs ? url.searchParams.get("to") : null, channel: channelUpper, teamId: teamUuid },
      kpis: {
        totalLeads: Number(f.total_leads || 0),
        convertidos: Number(f.convertidos || 0),
        altaPrioridade: Number(f.alta_prioridade || 0),
        totalConversasAtivas: totalConvs,
        slaHitRate: Number(slaHitRate.toFixed(2)),
      },
      byChannel: channelAgg.rows || [],
      produtividadeTop10: productivity.rows || [],
    };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[crm.executive-kpis.get]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
