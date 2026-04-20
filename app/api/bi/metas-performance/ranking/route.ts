import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectMetasPerformanceRanking } from "@/lib/server/biMetasPerformanceRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "metas");
    const pool = getCommercialPool();
    const rows = await selectMetasPerformanceRanking(pool, url);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/bi/metas-performance/ranking:", error);
    return NextResponse.json({ error: "Falha ao carregar ranking de metas." }, { status: 500 });
  }
}
