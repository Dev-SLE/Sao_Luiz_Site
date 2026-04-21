import { NextResponse } from "next/server";
import { requireGerencialOperacaoDataTab } from "@/lib/server/gerencialOperacaoAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { resolveFluxoPeriod, selectFluxoKpis } from "@/lib/server/biFluxoRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialOperacaoDataTab(req, "fluxo");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "fluxo");
    const pool = getCommercialPool();
    const row = await selectFluxoKpis(pool, url);
    return NextResponse.json({ row, periodApplied: resolveFluxoPeriod(url) });
  } catch (error) {
    console.error("GET /api/bi/fluxo/kpis:", error);
    return NextResponse.json({ error: "Falha ao carregar indicadores do fluxo." }, { status: 500 });
  }
}
