import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectSprintTabela } from "@/lib/server/biSprintVendasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "sprint");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "sprint");
    const pool = getCommercialPool();
    const rows = await selectSprintTabela(pool, url);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/bi/sprint-vendas/table:", error);
    return NextResponse.json({ error: "Falha ao carregar a matriz semanal." }, { status: 500 });
  }
}
