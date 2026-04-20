import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectFunilDrillVendedor } from "@/lib/server/biFunilVendasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "funil");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "funil");
    const vendedor = url.searchParams.get("vendedor") || "";
    if (!String(vendedor).trim()) {
      return NextResponse.json({ error: "Informe o vendedor para o detalhamento." }, { status: 400 });
    }
    const pool = getCommercialPool();
    const { rows, meta } = await selectFunilDrillVendedor(pool, url, vendedor);
    return NextResponse.json({ rows, periodApplied: meta.periodApplied });
  } catch (error) {
    console.error("GET /api/bi/funil-vendas/drill:", error);
    return NextResponse.json({ error: "Falha ao carregar detalhamento por vendedor." }, { status: 500 });
  }
}
