import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureFase1InfrastructureTables } from "@/lib/server/ensureFase1Infrastructure";
import { can, getSessionContext } from "@/lib/server/authorization";

export const runtime = "nodejs";

/** Lista solicitações internas do usuário autenticado. */
export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "portal.solicitacoes.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureFase1InfrastructureTables();
    const pool = getPool();
    const r = await pool.query(
      `
      SELECT id::text, created_at, status, payload
      FROM pendencias.portal_submissions
      WHERE channel = 'solicitacao' AND lower(username) = lower($1)
      ORDER BY created_at DESC
      LIMIT 100
    `,
      [session.username]
    );
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error("[portal.solicitacoes.get]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Abre nova solicitação interna. */
export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "portal.solicitacoes.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.tipo || "").trim();
    const descricao = String(body?.descricao || "").trim();
    if (!tipo || !descricao) {
      return NextResponse.json({ error: "Tipo e descrição são obrigatórios" }, { status: 400 });
    }

    await ensureFase1InfrastructureTables();
    const pool = getPool();
    const ins = await pool.query(
      `
      INSERT INTO pendencias.portal_submissions (channel, username, status, payload)
      VALUES ('solicitacao', $1, 'received', $2::jsonb)
      RETURNING id::text, created_at, status, payload
    `,
      [session.username, JSON.stringify({ tipo, descricao })]
    );
    return NextResponse.json({ item: ins.rows?.[0] || null });
  } catch (e) {
    console.error("[portal.solicitacoes.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
