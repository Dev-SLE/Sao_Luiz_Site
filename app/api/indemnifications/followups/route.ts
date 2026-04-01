import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables, ensureOccurrencesSchemaTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { insertOcorrenciasLog } from "../../../../lib/server/indemnificationWorkflow";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    await ensureCrmSchemaTables();
    const { searchParams } = new URL(req.url);
    const indemnificationId = String(searchParams.get("indemnificationId") || "").trim();
    if (!indemnificationId) return NextResponse.json({ error: "indemnificationId obrigatório" }, { status: 400 });
    const pool = getPool();
    const r = await pool.query(
      `
        SELECT f.*, a.name AS agency_name
        FROM pendencias.indemnification_agency_followups f
        LEFT JOIN pendencias.crm_agencies a ON a.id = f.agency_id
        WHERE f.indemnification_id = $1::uuid
        ORDER BY a.name NULLS LAST
      `,
      [indemnificationId]
    );
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error("[followups.get]", e);
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
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const indemnificationId = String(body?.indemnificationId || "").trim();
    const agencyId = String(body?.agencyId || "").trim();
    if (!indemnificationId || !agencyId) {
      return NextResponse.json({ error: "indemnificationId e agencyId obrigatórios" }, { status: 400 });
    }
    const expectedBy = body?.expectedBy ? String(body.expectedBy) : null;
    const q = await pool.query(
      `
        INSERT INTO pendencias.indemnification_agency_followups (
          indemnification_id, agency_id, expected_by, created_at
        ) VALUES ($1::uuid, $2::uuid, $3, NOW())
        ON CONFLICT (indemnification_id, agency_id) DO UPDATE SET expected_by = COALESCE(EXCLUDED.expected_by, pendencias.indemnification_agency_followups.expected_by)
        RETURNING *
      `,
      [indemnificationId, agencyId, expectedBy]
    );
    const ind = await pool.query(
      `SELECT o.cte, o.serie FROM pendencias.indemnifications i INNER JOIN pendencias.occurrences o ON o.id = i.occurrence_id WHERE i.id = $1::uuid`,
      [indemnificationId]
    );
    const row = ind.rows?.[0];
    await insertOcorrenciasLog(
      pool,
      "INDEM_AGENCY_FOLLOWUP_ADD",
      session.username,
      { indemnificationId, agencyId },
      row?.cte || null,
      row?.serie || null
    );
    return NextResponse.json({ item: q.rows?.[0] || null });
  } catch (e) {
    console.error("[followups.post]", e);
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
    const action = String(body?.action || "chase").trim();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const cur = await pool.query(`SELECT * FROM pendencias.indemnification_agency_followups WHERE id = $1::uuid LIMIT 1`, [id]);
    const fu = cur.rows?.[0];
    if (!fu) return NextResponse.json({ error: "Follow-up não encontrado" }, { status: 404 });

    const ind = await pool.query(
      `SELECT o.cte, o.serie FROM pendencias.indemnifications i INNER JOIN pendencias.occurrences o ON o.id = i.occurrence_id WHERE i.id = $1::uuid`,
      [fu.indemnification_id]
    );
    const cteRow = ind.rows?.[0];

    if (action === "chase") {
      await pool.query(
        `UPDATE pendencias.indemnification_agency_followups
         SET chase_count = chase_count + 1, last_chase_at = NOW()
         WHERE id = $1::uuid`,
        [id]
      );
      await insertOcorrenciasLog(
        pool,
        "INDEM_AGENCY_CHASE",
        session.username,
        { followupId: id, agencyId: fu.agency_id },
        cteRow?.cte || null,
        cteRow?.serie || null
      );
      const r = await pool.query(`SELECT * FROM pendencias.indemnification_agency_followups WHERE id = $1::uuid`, [id]);
      return NextResponse.json({ item: r.rows?.[0] || null });
    }

    if (action === "link_note") {
      const noteId = body?.noteId != null ? Number(body.noteId) : NaN;
      if (!Number.isFinite(noteId)) return NextResponse.json({ error: "noteId inválido" }, { status: 400 });
      await pool.query(
        `UPDATE pendencias.indemnification_agency_followups
         SET response_note_id = $2, responded_at = NOW()
         WHERE id = $1::uuid`,
        [id, noteId]
      );
      const r = await pool.query(`SELECT * FROM pendencias.indemnification_agency_followups WHERE id = $1::uuid`, [id]);
      return NextResponse.json({ item: r.rows?.[0] || null });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[followups.patch]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
