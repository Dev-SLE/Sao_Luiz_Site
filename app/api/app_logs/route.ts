import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureAppLogsTable } from "../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../lib/server/apiAuth";
import { getSessionContext } from "../../../lib/server/authorization";
import { getRequestId } from "../../../lib/server/requestId";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const requestId = getRequestId(req);
    const session = await getSessionContext(req);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (!session.mustChangePassword) {
      const guard = await requireApiPermissions(req, ["module.operacional.view", "module.crm.view", "module.comercial.view"]);
      if (guard.denied) return guard.denied;
    }
    await ensureAppLogsTable();
    const body = await req.json().catch(() => ({}));
    const level = String(body?.level || "INFO").trim().toUpperCase();
    const source = String(body?.source || "app").trim();
    const event = String(body?.event || "").trim();
    const username = body?.username ? String(body.username).trim() : null;
    const cte = body?.cte ? String(body.cte).trim() : null;
    const serie = body?.serie ? String(body.serie).trim() : null;
    const payload = { ...(body?.payload || {}), requestId };

    if (!event) {
      return NextResponse.json({ error: "event obrigatório" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
      `
        INSERT INTO pendencias.app_logs (level, source, event, username, cte, serie, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at
      `,
      [level, source, event, username, cte, serie, payload ? JSON.stringify(payload) : null]
    );

    return NextResponse.json({ success: true, requestId, ...result.rows?.[0] });
  } catch (error) {
    console.error("Erro ao gravar app log:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const requestId = getRequestId(req);
    const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    await ensureAppLogsTable();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 1000);
    const cte = (searchParams.get("cte") || "").trim();
    const serie = (searchParams.get("serie") || "").trim();
    const event = (searchParams.get("event") || "").trim();

    const where: string[] = [];
    const params: any[] = [];
    const push = (cond: string, val: any) => {
      params.push(val);
      where.push(cond.replace("?", `$${params.length}`));
    };
    if (cte) push("cte = ?", cte);
    if (serie) push("serie = ?", serie);
    if (event) push("event = ?", event);

    const pool = getPool();
    const result = await pool.query(
      `
        SELECT id, created_at, level, source, event, username, cte, serie, payload
        FROM pendencias.app_logs
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1}
      `,
      [...params, limit]
    );

    return NextResponse.json(result.rows || [], { headers: { "x-request-id": requestId } });
  } catch (error) {
    console.error("Erro ao ler app logs:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

