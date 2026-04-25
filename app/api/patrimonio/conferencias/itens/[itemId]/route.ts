import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { patchConferenciaItem } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ itemId: string }> }) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const { itemId } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pool = getPool();
    const row = await patchConferenciaItem(pool, itemId, body, g.session!.username);
    if (!row) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (e) {
    console.error("PATCH conferencia item", e);
    return NextResponse.json({ error: "Erro ao atualizar item." }, { status: 500 });
  }
}
