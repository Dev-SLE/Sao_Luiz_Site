import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { finalizarConferencia, getConferencia } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const { id } = await ctx.params;
  const pool = getPool();
  const data = await getConferencia(pool, id);
  if (!data) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { action?: string };
    if (body.action === "finalizar") {
      const pool = getPool();
      const row = await finalizarConferencia(pool, id);
      if (!row) return NextResponse.json({ error: "Não foi possível finalizar." }, { status: 400 });
      return NextResponse.json({ conferencia: row });
    }
    return NextResponse.json({ error: "Ação inválida. Use action: finalizar" }, { status: 400 });
  } catch (e) {
    console.error("PATCH /api/patrimonio/conferencias/[id]", e);
    return NextResponse.json({ error: "Erro." }, { status: 500 });
  }
}
