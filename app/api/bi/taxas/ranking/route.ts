import { NextResponse } from "next/server";
import { requireGerencialOperacaoDataTab } from "@/lib/server/gerencialOperacaoAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectTaxasRankingOportunidade } from "@/lib/server/biTaxasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialOperacaoDataTab(req, "taxas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "taxas");
    const pool = getCommercialPool();
    const lim = Math.min(24, Math.max(4, Number(url.searchParams.get("limit") || 12) || 12));
    const rows = await selectTaxasRankingOportunidade(pool, url, lim);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/bi/taxas/ranking:", error);
    return NextResponse.json({ error: "Falha ao carregar ranking de oportunidade." }, { status: 500 });
  }
}
