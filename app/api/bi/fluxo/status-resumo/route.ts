import { NextResponse } from "next/server";
import { requireGerencialOperacaoDataTab } from "@/lib/server/gerencialOperacaoAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectFluxoStatusResumo } from "@/lib/server/biFluxoRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialOperacaoDataTab(req, "fluxo");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "fluxo");
    const pool = getCommercialPool();
    const rows = await selectFluxoStatusResumo(pool, url);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/bi/fluxo/status-resumo:", error);
    return NextResponse.json({ error: "Falha ao carregar tipo da rede." }, { status: 500 });
  }
}
