import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectMetasFacetOptions } from "@/lib/server/biMetasPerformanceRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "metas");
    const pool = getCommercialPool();
    const data = await selectMetasFacetOptions(pool, url);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/bi/metas-performance/facet-options:", error);
    return NextResponse.json({ error: "Falha ao carregar opções de agência." }, { status: 500 });
  }
}
