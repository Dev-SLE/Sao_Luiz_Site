import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { can } from "../../../../lib/server/authorization";
import { isAdminSuperRole } from "../../../../lib/adminSuperRoles";

export const runtime = "nodejs";

function parseBool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, [
      "module.crm.view",
      "VIEW_CRM_CHAT",
      "VIEW_CRM_FUNIL",
      "VIEW_CRM_DASHBOARD",
    ]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const url = new URL(req.url);

    const all = parseBool(url.searchParams.get("all"));
    const status = url.searchParams.get("status");
    const session = guard.session!;
    const username = session.username || "";

    const seeAll = all && (can(session, "MANAGE_CRM_OPS") || isAdminSuperRole(session.role, session.username));

    const params: any[] = [];
    let where = "1=1";
    if (!seeAll) {
      params.push(username.toLowerCase());
      where = `(LOWER(t.assigned_username) = $1 OR LOWER(COALESCE(t.created_by,'')) = $1)`;
    }
    if (status && String(status).toUpperCase() !== "ALL") {
      params.push(String(status).toUpperCase());
      where += ` AND t.status = $${params.length}`;
    }

    const res = await pool.query(
      `
      SELECT
        t.id,
        t.title,
        t.notes,
        t.status,
        t.due_at,
        t.assigned_username,
        t.created_by,
        t.lead_id,
        t.conversation_id,
        t.created_at,
        t.updated_at,
        l.title AS lead_title,
        l.protocol_number AS lead_protocol
      FROM pendencias.crm_tasks t
      LEFT JOIN pendencias.crm_leads l ON l.id = t.lead_id
      WHERE ${where}
      ORDER BY
        CASE WHEN t.status = 'OPEN' THEN 0 ELSE 1 END,
        t.due_at NULLS LAST,
        t.created_at DESC
      LIMIT 500
    `,
      params
    );

    return NextResponse.json({ items: res.rows || [] });
  } catch (error) {
    console.error("[crm.tasks.get]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, [
      "module.crm.view",
      "VIEW_CRM_CHAT",
      "VIEW_CRM_FUNIL",
      "VIEW_CRM_DASHBOARD",
    ]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const action = String(body?.action || "CREATE").toUpperCase();
    const session = guard.session!;

    if (action === "CREATE") {
      const title = String(body?.title || "").trim();
      if (!title) return NextResponse.json({ error: "title obrigatório" }, { status: 400 });
      let assignedUsername = String(body?.assignedUsername || session.username || "").trim();
      if (!assignedUsername) return NextResponse.json({ error: "assignedUsername obrigatório" }, { status: 400 });
      if (
        assignedUsername.toLowerCase() !== String(session.username || "").toLowerCase() &&
        !can(session, "MANAGE_CRM_OPS") &&
        !isAdminSuperRole(session.role, session.username)
      ) {
        assignedUsername = String(session.username);
      }
      const notes = body?.notes != null ? String(body.notes) : null;
      const dueAt = body?.dueAt ? String(body.dueAt) : null;
      const leadId = body?.leadId ? String(body.leadId) : null;
      const conversationId = body?.conversationId ? String(body.conversationId) : null;

      const ins = await pool.query(
        `
        INSERT INTO pendencias.crm_tasks
          (title, notes, status, due_at, assigned_username, created_by, lead_id, conversation_id, created_at, updated_at)
        VALUES ($1,$2,'OPEN',$3::timestamptz,$4,$5,$6::uuid,$7::uuid,NOW(),NOW())
        RETURNING id
      `,
        [title, notes, dueAt || null, assignedUsername, session.username || null, leadId, conversationId]
      );
      return NextResponse.json({ success: true, id: ins.rows?.[0]?.id });
    }

    if (action === "UPDATE") {
      const id = String(body?.id || "").trim();
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      const existing = await pool.query(
        `SELECT assigned_username, created_by, title, notes, status, due_at FROM pendencias.crm_tasks WHERE id = $1::uuid LIMIT 1`,
        [id]
      );
      const row = existing.rows?.[0];
      if (!row) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
      const uname = String(session.username || "").toLowerCase();
      const isOwner =
        String(row.assigned_username || "").toLowerCase() === uname ||
        String(row.created_by || "").toLowerCase() === uname;
      if (!isOwner && !can(session, "MANAGE_CRM_OPS") && !isAdminSuperRole(session.role, session.username)) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }

      const curTitle = String(row.title ?? "");
      const curNotes = row.notes != null ? String(row.notes) : "";
      const curStatus = String(row.status || "OPEN");
      const curDue = row.due_at ? new Date(row.due_at).toISOString() : null;

      const nextTitle = body?.title !== undefined ? String(body.title).trim() : curTitle;
      const nextNotes = body?.notes !== undefined ? String(body.notes) : curNotes;
      const nextStatus = body?.status !== undefined ? String(body.status).toUpperCase() : curStatus;
      let nextDue: string | null = curDue;
      if (body?.dueAt !== undefined) {
        nextDue = body.dueAt ? String(body.dueAt) : null;
      }

      await pool.query(
        `
        UPDATE pendencias.crm_tasks SET
          title = $2,
          notes = $3,
          status = $4,
          due_at = $5::timestamptz,
          updated_at = NOW()
        WHERE id = $1::uuid
      `,
        [id, nextTitle || curTitle, nextNotes, nextStatus, nextDue]
      );
      return NextResponse.json({ success: true });
    }

    if (action === "DELETE") {
      const id = String(body?.id || "").trim();
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      const existing = await pool.query(
        `SELECT assigned_username, created_by FROM pendencias.crm_tasks WHERE id = $1::uuid LIMIT 1`,
        [id]
      );
      const row = existing.rows?.[0];
      if (!row) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
      const uname = String(session.username || "").toLowerCase();
      const isOwner =
        String(row.assigned_username || "").toLowerCase() === uname ||
        String(row.created_by || "").toLowerCase() === uname;
      if (!isOwner && !can(session, "MANAGE_CRM_OPS") && !isAdminSuperRole(session.role, session.username)) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }
      await pool.query(`DELETE FROM pendencias.crm_tasks WHERE id = $1::uuid`, [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    console.error("[crm.tasks.post]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
