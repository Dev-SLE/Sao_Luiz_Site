import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { can, getSessionContext } from "../../../lib/server/authorization";
import { operationalAssignmentLogsVisibilitySql } from "../../../lib/server/operationalAssignmentLogFilter";

export const runtime = "nodejs";

async function ensureAckTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.operational_notification_acks (
      username text PRIMARY KEY,
      last_log_id bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureAckTable();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 20)));
    const ackRes = await pool.query(
      `SELECT last_log_id FROM pendencias.operational_notification_acks WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [session.username]
    );
    const lastLogId = Number(ackRes.rows?.[0]?.last_log_id || 0);
    const vis = operationalAssignmentLogsVisibilitySql(1);
    const logsRes = await pool.query(
      `
        SELECT id, created_at, event, cte, serie, payload
        FROM pendencias.app_logs
        WHERE source = 'operacional'
          AND event IN ('CTE_ASSIGNMENT_UPSERT', 'CTE_ASSIGNMENT_CLEAR')
          ${vis}
          AND id > $2
        ORDER BY id DESC
        LIMIT $3
      `,
      [session.username, lastLogId, limit]
    );
    return NextResponse.json({
      unreadCount: Number(logsRes.rows?.length || 0),
      items: (logsRes.rows || []).map((r: any) => ({
        id: Number(r.id),
        createdAt: r.created_at || null,
        event: String(r.event || ""),
        cte: r.cte ? String(r.cte) : null,
        serie: r.serie ? String(r.serie) : null,
        payload: r.payload || null,
      })),
      lastLogId,
    });
  } catch (error) {
    console.error("operational-notifications GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureAckTable();
    const body = await req.json().catch(() => ({}));
    const lastLogId = Math.max(0, Number(body?.lastLogId || 0));
    const pool = getPool();
    await pool.query(
      `
        INSERT INTO pendencias.operational_notification_acks (username, last_log_id, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (username) DO UPDATE
        SET last_log_id = GREATEST(pendencias.operational_notification_acks.last_log_id, EXCLUDED.last_log_id),
            updated_at = NOW()
      `,
      [session.username, lastLogId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("operational-notifications POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
