import { NextResponse } from "next/server";
import { requireGerencialOperacaoDataTab } from "@/lib/server/gerencialOperacaoAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectTaxasComposicao } from "@/lib/server/biTaxasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialOperacaoDataTab(req, "taxas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "taxas");
    const pool = getCommercialPool();
    const rows = await selectTaxasComposicao(pool, url);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/bi/taxas/composicao:", error);
    return NextResponse.json({ error: "Falha ao carregar composição." }, { status: 500 });
  }
}
