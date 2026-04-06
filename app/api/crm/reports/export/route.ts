import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../../lib/server/apiAuth";

export const runtime = "nodejs";

function range(url: URL): { from: string | null; to: string | null } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return {
    from: from ? `${from}T00:00:00.000Z` : null,
    to: to ? `${to}T23:59:59.999Z` : null,
  };
}

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, [
      "MANAGE_CRM_OPS",
      "MANAGE_SETTINGS",
      "VIEW_CRM_DASHBOARD",
    ]);
    if (guard.denied) return guard.denied;

    await ensureCrmSchemaTables();
    const pool = getPool();
    const url = new URL(req.url);
    const type = String(url.searchParams.get("type") || "campaign_dispatches").toLowerCase();
    const { from, to } = range(url);
    const format = String(url.searchParams.get("format") || "json").toLowerCase();

    if (type === "campaign_dispatches") {
      const res = await pool.query(
        `
        SELECT
          d.id,
          d.campaign_id,
          cam.name AS campaign_name,
          d.lead_id,
          d.conversation_id,
          d.opted_in,
          d.status,
          d.created_at
        FROM pendencias.crm_campaign_dispatches d
        INNER JOIN pendencias.crm_campaigns cam ON cam.id = d.campaign_id
        WHERE ($1::timestamptz IS NULL OR d.created_at >= $1::timestamptz)
          AND ($2::timestamptz IS NULL OR d.created_at <= $2::timestamptz)
        ORDER BY d.created_at DESC
        LIMIT 8000
      `,
        [from, to]
      );
      const rows = res.rows || [];
      if (format === "csv") {
        const header = "id,campaign_id,campaign_name,lead_id,conversation_id,opted_in,status,created_at\n";
        const body = rows
          .map((r: any) =>
            [
              r.id,
              r.campaign_id,
              String(r.campaign_name || "").replace(/"/g, '""'),
              r.lead_id,
              r.conversation_id,
              r.opted_in,
              r.status,
              r.created_at,
            ].join(",")
          )
          .join("\n");
        return new NextResponse(header + body, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="crm_campaign_dispatches.csv"`,
          },
        });
      }
      return NextResponse.json({ type, count: rows.length, rows });
    }

    if (type === "sla_agents") {
      const res = await pool.query(
        `
        SELECT
          COALESCE(assigned_username,'SEM_RESPONSAVEL') AS agente,
          COUNT(*)::int AS total_conversas,
          COUNT(*) FILTER (WHERE sla_breached_at IS NOT NULL)::int AS estouradas,
          COUNT(*) FILTER (WHERE sla_breached_at IS NULL AND sla_due_at IS NOT NULL)::int AS dentro_prazo
        FROM pendencias.crm_conversations
        WHERE is_active = true
          AND ($1::timestamptz IS NULL OR COALESCE(updated_at, created_at) >= $1::timestamptz)
          AND ($2::timestamptz IS NULL OR COALESCE(updated_at, created_at) <= $2::timestamptz)
        GROUP BY COALESCE(assigned_username,'SEM_RESPONSAVEL')
        ORDER BY estouradas DESC, total_conversas DESC
        LIMIT 500
      `,
        [from, to]
      );
      const rows = res.rows || [];
      if (format === "csv") {
        const header = "agente,total_conversas,sla_estouradas,dentro_ou_sem_sla\n";
        const body = rows
          .map((r: any) => [r.agente, r.total_conversas, r.estouradas, r.dentro_prazo].join(","))
          .join("\n");
        return new NextResponse(header + body, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="crm_sla_por_agente.csv"`,
          },
        });
      }
      return NextResponse.json({ type, rows });
    }

    if (type === "consent_events") {
      const guardStrict = await requireApiPermissions(req, ["MANAGE_CRM_OPS", "MANAGE_SETTINGS"]);
      if (guardStrict.denied) return guardStrict.denied;
      const res = await pool.query(
        `
        SELECT id, phone_last10, email_normalized, lead_id, event_type, reason, actor_username, created_at
        FROM pendencias.crm_consent_events
        WHERE ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
          AND ($2::timestamptz IS NULL OR created_at <= $2::timestamptz)
        ORDER BY created_at DESC
        LIMIT 8000
      `,
        [from, to]
      );
      const rows = res.rows || [];
      if (format === "csv") {
        const header = "id,phone_last10,email,lead_id,event_type,reason,actor,created_at\n";
        const body = rows
          .map((r: any) =>
            [
              r.id,
              r.phone_last10,
              r.email_normalized,
              r.lead_id,
              r.event_type,
              String(r.reason || "").replace(/"/g, '""'),
              r.actor_username,
              r.created_at,
            ].join(",")
          )
          .join("\n");
        return new NextResponse(header + body, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="crm_consent_events.csv"`,
          },
        });
      }
      return NextResponse.json({ type, rows });
    }

    return NextResponse.json({ error: "type inválido" }, { status: 400 });
  } catch (e) {
    console.error("[crm.reports.export]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
