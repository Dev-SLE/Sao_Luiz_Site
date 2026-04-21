import { NextResponse } from "next/server";
import { requireGerencialOperacaoDataTab } from "@/lib/server/gerencialOperacaoAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectTaxasDrillAgencia } from "@/lib/server/biTaxasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialOperacaoDataTab(req, "taxas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "taxas");
    const agencia = url.searchParams.get("agencia")?.trim();
    if (!agencia) {
      return NextResponse.json({ error: "Parâmetro agencia é obrigatório." }, { status: 400 });
    }
    const pool = getCommercialPool();
    const rows = await selectTaxasDrillAgencia(pool, url, agencia);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/bi/taxas/drill:", error);
    return NextResponse.json({ error: "Falha ao carregar o detalhe." }, { status: 500 });
  }
}
