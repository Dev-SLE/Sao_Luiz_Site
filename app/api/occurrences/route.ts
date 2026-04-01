import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "").trim();
    const leadId = String(searchParams.get("leadId") || "").trim();
    const where: string[] = [];
    const params: any[] = [];
    if (cte) {
      params.push(cte);
      where.push(`cte = $${params.length}`);
    }
    if (serie) {
      params.push(serie);
      where.push(`(serie = $${params.length} OR ltrim(serie, '0') = ltrim($${params.length}, '0'))`);
    }
    if (leadId) {
      params.push(leadId);
      where.push(`lead_id = $${params.length}::uuid`);
    }
    const sql = `
      SELECT *
      FROM pendencias.occurrences
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 500
    `;
    const r = await pool.query(sql, params);
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error("[occurrences.get]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "0").trim() || "0";
    const occurrenceType = String(body?.occurrenceType || "OUTROS").toUpperCase();
    const description = String(body?.description || "").trim();
    if (!cte || !description) {
      return NextResponse.json({ error: "cte e description são obrigatórios" }, { status: 400 });
    }
    const q = await pool.query(
      `
        INSERT INTO pendencias.occurrences (
          cte, serie, occurrence_type, description, status, source, lead_id, contact_name, contact_phone, created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,'ABERTA',$5,$6,$7,$8,$9,NOW(),NOW())
        RETURNING *
      `,
      [
        cte,
        serie,
        occurrenceType,
        description,
        String(body?.source || "OPERACIONAL").toUpperCase(),
        body?.leadId ? String(body.leadId) : null,
        body?.contactName ? String(body.contactName) : null,
        body?.contactPhone ? String(body.contactPhone) : null,
        body?.createdBy ? String(body.createdBy) : null,
      ]
    );
    return NextResponse.json({ item: q.rows?.[0] || null });
  } catch (e) {
    console.error("[occurrences.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
