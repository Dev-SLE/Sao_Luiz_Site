import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { insertAtivo, listAtivos } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const pool = getPool();
  const { rows, total } = await listAtivos(pool, {
    q: url.searchParams.get("q") || undefined,
    agencia: url.searchParams.get("agencia") || undefined,
    categoria: url.searchParams.get("categoria") || undefined,
    status: url.searchParams.get("status") || undefined,
    responsavel: url.searchParams.get("responsavel") || undefined,
    limit,
    offset,
  });
  return NextResponse.json({ rows, total, limit, offset });
}

export async function POST(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!String(body.numero_patrimonio || "").trim() || !String(body.descricao || "").trim() || !String(body.categoria || "").trim()) {
      return NextResponse.json({ error: "Número patrimonial, descrição e categoria são obrigatórios." }, { status: 400 });
    }
    const pool = getPool();
    const row = await insertAtivo(pool, body, g.session!.username);
    if (!row) return NextResponse.json({ error: "Falha ao criar ativo." }, { status: 500 });
    return NextResponse.json({ ativo: row });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json({ error: "Número patrimonial já existe." }, { status: 409 });
    }
    console.error("POST /api/patrimonio/ativos", e);
    return NextResponse.json({ error: "Erro ao criar ativo." }, { status: 500 });
  }
}
