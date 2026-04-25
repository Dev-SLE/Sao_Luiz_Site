import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { getAtivo, updateAtivo } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requirePatrimonioModule(_req);
  if (g.denied) return g.denied;
  const { id } = await ctx.params;
  const pool = getPool();
  const row = await getAtivo(pool, id);
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ ativo: row });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pool = getPool();
    const row = await updateAtivo(pool, id, body);
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ ativo: row });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json({ error: "Número patrimonial já existe." }, { status: 409 });
    }
    console.error("PATCH /api/patrimonio/ativos/[id]", e);
    return NextResponse.json({ error: "Erro ao atualizar." }, { status: 500 });
  }
}
