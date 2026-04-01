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
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "0").trim() || "0";
    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });

    const dossierRes = await pool.query(
      `SELECT * FROM pendencias.dossiers WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0')) LIMIT 1`,
      [cte, serie]
    );
    const dossier = dossierRes.rows?.[0] || null;
    const occurrences = await pool.query(
      `SELECT * FROM pendencias.occurrences WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0')) ORDER BY created_at DESC`,
      [cte, serie]
    );
    return NextResponse.json({ dossier, occurrences: occurrences.rows || [] });
  } catch (e) {
    console.error("[dossie.get]", e);
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
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "0").trim() || "0";
    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });
    const title = String(body?.title || `Dossiê CTE ${cte}/${serie}`).trim();
    const q = await pool.query(
      `
        INSERT INTO pendencias.dossiers (cte, serie, title, status, generated_by, generated_at, created_at, updated_at)
        VALUES ($1,$2,$3,'ATIVO',$4,NOW(),NOW(),NOW())
        ON CONFLICT (cte, serie)
        DO UPDATE SET title = EXCLUDED.title, generated_by = EXCLUDED.generated_by, generated_at = NOW(), updated_at = NOW()
        RETURNING *
      `,
      [cte, serie, title, body?.generatedBy ? String(body.generatedBy) : null]
    );
    return NextResponse.json({ dossier: q.rows?.[0] || null });
  } catch (e) {
    console.error("[dossie.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
