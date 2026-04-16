import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { invalidateReadCacheKey, readThroughCache } from "../../../../lib/server/readThroughCache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const payload = await readThroughCache("crm:sla:get", 25_000, async () => {
      const pool = getPool();
      const res = await pool.query(
        `
        SELECT id, team_id, topic, channel, priority, sla_minutes, is_active
        FROM pendencias.crm_queue_sla
        ORDER BY updated_at DESC
      `
      );
      return {
        items: (res.rows || []).map((r: any) => ({
          id: String(r.id),
          teamId: r.team_id ? String(r.team_id) : null,
          topic: r.topic ? String(r.topic) : null,
          channel: r.channel ? String(r.channel) : null,
          priority: r.priority ? String(r.priority) : null,
          slaMinutes: Number(r.sla_minutes || 30),
          isActive: !!r.is_active,
        })),
      };
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("CRM SLA GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = body?.action ? String(body.action).toUpperCase() : "UPSERT";
    if (action === "DELETE") {
      const id = body?.id ? String(body.id) : null;
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      await pool.query("DELETE FROM pendencias.crm_queue_sla WHERE id = $1", [id]);
      invalidateReadCacheKey("crm:sla:get");
      return NextResponse.json({ success: true });
    }
    const id = body?.id ? String(body.id) : null;
    const payload = {
      teamId: body?.teamId ? String(body.teamId) : null,
      topic: body?.topic ? String(body.topic).toUpperCase() : null,
      channel: body?.channel ? String(body.channel).toUpperCase() : null,
      priority: body?.priority ? String(body.priority).toUpperCase() : null,
      slaMinutes: Number(body?.slaMinutes || 30),
      isActive: body?.isActive === undefined ? true : !!body.isActive,
    };
    if (!id) {
      const ins = await pool.query(
        `
          INSERT INTO pendencias.crm_queue_sla(team_id, topic, channel, priority, sla_minutes, is_active, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
          RETURNING id
        `,
        [payload.teamId, payload.topic, payload.channel, payload.priority, payload.slaMinutes, payload.isActive]
      );
      invalidateReadCacheKey("crm:sla:get");
      return NextResponse.json({ id: ins.rows?.[0]?.id, success: true });
    }
    await pool.query(
      `
        UPDATE pendencias.crm_queue_sla
        SET team_id=$2, topic=$3, channel=$4, priority=$5, sla_minutes=$6, is_active=$7, updated_at=NOW()
        WHERE id=$1
      `,
      [id, payload.teamId, payload.topic, payload.channel, payload.priority, payload.slaMinutes, payload.isActive]
    );
    invalidateReadCacheKey("crm:sla:get");
    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error("CRM SLA POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

