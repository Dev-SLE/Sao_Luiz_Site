import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectFunilTabela } from "@/lib/server/biFunilVendasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "funil");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "funil");
    const pool = getCommercialPool();
    const { rows, meta } = await selectFunilTabela(pool, url, { defaultLimit: 500, maxLimit: 3000 });
    return NextResponse.json({ rows, periodApplied: meta.periodApplied });
  } catch (error) {
    console.error("GET /api/bi/funil-vendas/table:", error);
    return NextResponse.json({ error: "Falha ao carregar tabela de cotações." }, { status: 500 });
  }
}
