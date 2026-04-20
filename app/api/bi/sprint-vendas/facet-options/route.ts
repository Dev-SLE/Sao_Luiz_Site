import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectSprintFacetOptions } from "@/lib/server/biSprintVendasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "sprint");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "sprint");
    const pool = getCommercialPool();
    const data = await selectSprintFacetOptions(pool, url);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/bi/sprint-vendas/facet-options:", error);
    return NextResponse.json({ error: "Falha ao carregar opções de filtro." }, { status: 500 });
  }
}
