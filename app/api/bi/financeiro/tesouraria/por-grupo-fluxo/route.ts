import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseTesourariaFiltersFromUrl, selectTesourariaPorGrupoFluxo } from "@/lib/server/biTesourariaRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const f = parseTesourariaFiltersFromUrl(url);
    const pool = getCommercialPool();
    const rows = await selectTesourariaPorGrupoFluxo(pool, f);
    return NextResponse.json({ rows, period: { from: f.from, to: f.to } });
  } catch (error) {
    console.error("GET /api/bi/financeiro/tesouraria/por-grupo-fluxo:", error);
    return NextResponse.json({ error: "Falha ao carregar distribuição por grupo de fluxo." }, { status: 500 });
  }
}
