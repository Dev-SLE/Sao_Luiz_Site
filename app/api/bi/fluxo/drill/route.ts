import { NextResponse } from "next/server";
import { requireGerencialOperacaoDataTab } from "@/lib/server/gerencialOperacaoAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { resolveFluxoPeriod, selectFluxoDrillAgencia } from "@/lib/server/biFluxoRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialOperacaoDataTab(req, "fluxo");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "fluxo");
    const agencia = url.searchParams.get("agencia")?.trim() ?? "";
    if (!agencia) {
      return NextResponse.json({ error: "Informe a agência." }, { status: 400 });
    }
    const pool = getCommercialPool();
    const rows = await selectFluxoDrillAgencia(pool, url, agencia);
    return NextResponse.json({ rows, periodApplied: resolveFluxoPeriod(url), agencia });
  } catch (error) {
    console.error("GET /api/bi/fluxo/drill:", error);
    return NextResponse.json({ error: "Falha ao carregar o detalhe da agência." }, { status: 500 });
  }
}
