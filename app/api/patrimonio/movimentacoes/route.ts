import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { createMovimentacao, listMovimentacoes } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const url = new URL(req.url);
  const ativoId = url.searchParams.get("ativoId");
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
  const pool = getPool();
  const rows = await listMovimentacoes(pool, ativoId, limit);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.ativo_id || !body.tipo_movimentacao) {
      return NextResponse.json({ error: "ativo_id e tipo_movimentacao são obrigatórios." }, { status: 400 });
    }
    const pool = getPool();
    const r = await createMovimentacao(pool, body, g.session!.username);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ movimentacao: r.row });
  } catch (e) {
    console.error("POST /api/patrimonio/movimentacoes", e);
    return NextResponse.json({ error: "Erro ao registrar movimentação." }, { status: 500 });
  }
}
