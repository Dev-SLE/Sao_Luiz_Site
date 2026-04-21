import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { resolveTcPeriod, selectTcPipeline } from "@/lib/server/biTabelasCombinadasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "carteira");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "carteira");
    const pool = getCommercialPool();
    const rows = await selectTcPipeline(pool, url);
    return NextResponse.json({ rows, periodApplied: resolveTcPeriod(url) });
  } catch (error) {
    console.error("GET /api/bi/tabelas-combinadas/pipeline:", error);
    return NextResponse.json({ error: "Falha ao carregar pipeline de renovacao." }, { status: 500 });
  }
}
