import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const occurrenceId = String(searchParams.get("occurrenceId") || "").trim();
    if (!occurrenceId) return NextResponse.json({ items: [] });
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
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const occurrenceId = String(body?.occurrenceId || "").trim();
    if (!occurrenceId) return NextResponse.json({ error: "occurrenceId obrigatório" }, { status: 400 });
    const q = await pool.query(
      `
        INSERT INTO pendencias.indemnifications (
          occurrence_id, status, amount, currency, decision, due_date, responsible, legal_risk, notes, created_by, created_at, updated_at
        ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
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
        body?.createdBy ? String(body.createdBy) : null,
      ]
    );
    return NextResponse.json({ item: q.rows?.[0] || null });
  } catch (e) {
    console.error("[indemnifications.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
