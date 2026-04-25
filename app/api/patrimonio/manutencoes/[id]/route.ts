import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { updateManutencao } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pool = getPool();
    const r = await updateManutencao(pool, id, body, g.session!.username);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ manutencao: r.row });
  } catch (e) {
    console.error("PATCH /api/patrimonio/manutencoes/[id]", e);
    return NextResponse.json({ error: "Erro ao atualizar manutenção." }, { status: 500 });
  }
}
