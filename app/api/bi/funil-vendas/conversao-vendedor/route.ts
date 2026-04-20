import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectFunilConversaoVendedor } from "@/lib/server/biFunilVendasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "funil");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "funil");
    const pool = getCommercialPool();
    const { rows, meta } = await selectFunilConversaoVendedor(pool, url);
    return NextResponse.json({ rows, periodApplied: meta.periodApplied });
  } catch (error) {
    console.error("GET /api/bi/funil-vendas/conversao-vendedor:", error);
    return NextResponse.json({ error: "Falha ao carregar conversão por vendedor." }, { status: 500 });
  }
}
