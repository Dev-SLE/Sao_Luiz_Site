import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { resolveTcPeriod, selectTcStatusDiagnostico } from "@/lib/server/biTabelasCombinadasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "carteira");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "carteira");
    const pool = getCommercialPool();
    const rows = await selectTcStatusDiagnostico(pool, url);
    return NextResponse.json({ rows, periodApplied: resolveTcPeriod(url) });
  } catch (error) {
    console.error("GET /api/bi/tabelas-combinadas/status-diagnostico:", error);
    return NextResponse.json({ error: "Falha ao carregar diagnostico da base." }, { status: 500 });
  }
}
