import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectMetasPerformanceKpis } from "@/lib/server/biMetasPerformanceRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "metas");
    const pool = getCommercialPool();
    const { rows, meta } = await selectMetasPerformanceKpis(pool, url);
    return NextResponse.json({ rows, meta });
  } catch (error) {
    console.error("GET /api/bi/metas-performance/kpis:", error);
    return NextResponse.json({ error: "Falha ao carregar indicadores de metas." }, { status: 500 });
  }
}
