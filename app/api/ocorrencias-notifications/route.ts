import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../lib/server/authorization";

export const runtime = "nodejs";

const EVENTS = [
  "INDEM_FIELD_EDIT",
  "INDEM_SUBMIT_APPROVAL",
  "INDEM_REJECTED",
  "INDEM_APPROVED",
  "INDEM_APPROVED_LANCAMENTOS",
  "INDEM_ASSIGNED_LANCAMENTOS",
  "INDEM_FORWARD_FINANCE",
  "INDEM_COMMENT",
  "INDEM_POSTED",
  "INDEM_AGENCY_FOLLOWUP_ADD",
  "INDEM_AGENCY_CHASE",
  "OCCURRENCE_TRACK",
];

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 20)));

    const ackRes = await pool.query(
      `SELECT last_log_id FROM pendencias.ocorrencias_notification_acks WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [session.username]
    );
    const lastLogId = Number(ackRes.rows?.[0]?.last_log_id || 0);

    const logsRes = await pool.query(
      `
        SELECT id, created_at, event, username, cte, serie, payload
        FROM pendencias.app_logs
        WHERE source = 'ocorrencias'
          AND event = ANY($1::text[])
          AND id > $2
        ORDER BY id DESC
        LIMIT $3
      `,
      [EVENTS, lastLogId, limit]
    );

    return NextResponse.json({
      unreadCount: Number(logsRes.rows?.length || 0),
      items: (logsRes.rows || []).map((r: any) => ({
        id: Number(r.id),
        createdAt: r.created_at || null,
        event: String(r.event || ""),
        username: r.username ? String(r.username) : null,
        cte: r.cte ? String(r.cte) : null,
        serie: r.serie ? String(r.serie) : null,
        payload: r.payload || null,
      })),
      lastLogId,
    });
  } catch (e) {
    console.error("[ocorrencias-notifications]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const body = await req.json().catch(() => ({}));
    const lastLogId = Math.max(0, Number(body?.lastLogId || 0));
    const pool = getPool();
    await pool.query(
      `
        INSERT INTO pendencias.ocorrencias_notification_acks (username, last_log_id, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (username) DO UPDATE
        SET last_log_id = GREATEST(pendencias.ocorrencias_notification_acks.last_log_id, EXCLUDED.last_log_id),
            updated_at = NOW()
      `,
      [session.username, lastLogId]
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[ocorrencias-notifications post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
