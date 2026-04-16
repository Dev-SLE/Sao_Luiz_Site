import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { bumpApiRoute } from "../../../../lib/server/apiHitMeter";
import { readThroughCache } from "../../../../lib/server/readThroughCache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureCrmSchemaTables();
    bumpApiRoute("GET /api/crm/agencies-list");
    const payload = await readThroughCache("crm:agencies-list:get", 60_000, async () => {
      const pool = getPool();
      const r = await pool.query(
        `SELECT id, name, city, state, phone FROM pendencias.crm_agencies WHERE is_active IS NOT FALSE ORDER BY name ASC LIMIT 500`
      );
      return { items: r.rows || [] };
    });
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[agencies-list]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
