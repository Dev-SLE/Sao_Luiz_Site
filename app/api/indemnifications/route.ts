import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../lib/server/authorization";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const byId = String(searchParams.get("id") || "").trim();
    if (byId) {
      const one = await pool.query(
        `
          SELECT i.*, o.cte AS occurrence_cte, o.serie AS occurrence_serie, o.occurrence_type,
                 o.status AS occurrence_status, o.resolution_track AS occurrence_resolution_track
          FROM pendencias.indemnifications i
          INNER JOIN pendencias.occurrences o ON o.id = i.occurrence_id
          WHERE i.id = $1::uuid LIMIT 1
        `,
        [byId]
      );
      return NextResponse.json({ item: one.rows?.[0] || null });
    }
    const occurrenceId = String(searchParams.get("occurrenceId") || "").trim();
    if (!occurrenceId) {
      const r = await pool.query(`
        SELECT
          i.*,
          o.cte AS occurrence_cte,
          o.serie AS occurrence_serie,
          o.occurrence_type,
          o.status AS occurrence_status,
          o.resolution_track AS occurrence_resolution_track
        FROM pendencias.indemnifications i
        INNER JOIN pendencias.occurrences o ON o.id = i.occurrence_id
        ORDER BY i.updated_at DESC, i.created_at DESC
        LIMIT 500
      `);
      return NextResponse.json({ items: r.rows || [] });
    }
    const r = await pool.query(
      `SELECT * FROM pendencias.indemnifications WHERE occurrence_id = $1::uuid ORDER BY created_at DESC`,
      [occurrenceId]
    );
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error("[indemnifications.get]", e);
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
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const occurrenceId = String(body?.occurrenceId || "").trim();
    if (!occurrenceId) return NextResponse.json({ error: "occurrenceId obrigatório" }, { status: 400 });
    const q = await pool.query(
      `
        INSERT INTO pendencias.indemnifications (
          occurrence_id, status, amount, currency, decision, due_date, responsible, legal_risk, notes,
          facts, responsibilities, indemnification_body, others,
          created_by, created_at, updated_at
        ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
        RETURNING *
      `,
      [
        occurrenceId,
        String(body?.status || "ATIVA").toUpperCase(),
        body?.amount != null ? Number(body.amount) : null,
        String(body?.currency || "BRL").toUpperCase(),
        body?.decision ? String(body.decision) : null,
        body?.dueDate ? String(body.dueDate) : null,
        body?.responsible ? String(body.responsible) : null,
        !!body?.legalRisk,
        body?.notes ? String(body.notes) : null,
        body?.facts != null ? String(body.facts) : null,
        body?.responsibilities != null ? String(body.responsibilities) : null,
        body?.indemnificationBody != null ? String(body.indemnificationBody) : null,
        body?.others != null ? String(body.others) : null,
        body?.createdBy ? String(body.createdBy) : null,
      ]
    );
    return NextResponse.json({ item: q.rows?.[0] || null });
  } catch (e) {
    console.error("[indemnifications.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const status = body?.status != null ? String(body.status).toUpperCase() : null;
    const notes = body?.notes != null ? String(body.notes) : null;
    const amount = body?.amount != null && body?.amount !== "" ? Number(body.amount) : null;
    const facts = body?.facts !== undefined ? (body.facts != null ? String(body.facts) : null) : undefined;
    const responsibilities = body?.responsibilities !== undefined ? (body.responsibilities != null ? String(body.responsibilities) : null) : undefined;
    const indemnification_body = body?.indemnification_body !== undefined ? (body.indemnification_body != null ? String(body.indemnification_body) : null) : undefined;
    const others = body?.others !== undefined ? (body.others != null ? String(body.others) : null) : undefined;

    const cur = await pool.query(`SELECT id FROM pendencias.indemnifications WHERE id = $1::uuid LIMIT 1`, [id]);
    if (!cur.rows?.length) return NextResponse.json({ error: "Indenização não encontrada" }, { status: 404 });

    const updates: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (notes != null) {
      params.push(notes);
      updates.push(`notes = $${params.length}`);
    }
    if (amount !== null && !Number.isNaN(amount)) {
      params.push(amount);
      updates.push(`amount = $${params.length}`);
    }
    if (facts !== undefined) {
      params.push(facts);
      updates.push(`facts = $${params.length}`);
    }
    if (responsibilities !== undefined) {
      params.push(responsibilities);
      updates.push(`responsibilities = $${params.length}`);
    }
    if (indemnification_body !== undefined) {
      params.push(indemnification_body);
      updates.push(`indemnification_body = $${params.length}`);
    }
    if (others !== undefined) {
      params.push(others);
      updates.push(`others = $${params.length}`);
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }
    params.push(id);
    const r = await pool.query(
      `UPDATE pendencias.indemnifications SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${params.length}::uuid RETURNING *`,
      params
    );
    return NextResponse.json({ item: r.rows?.[0] || null });
  } catch (e) {
    console.error("[indemnifications.patch]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
