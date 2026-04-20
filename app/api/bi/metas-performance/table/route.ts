import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { buildMetasKpisFromDetailRows, selectMetasPerformanceDetail } from "@/lib/server/biMetasPerformanceRead";
import { serializePgRow } from "@/lib/server/biComissoesRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "metas");
    const pool = getCommercialPool();
    const { rows, meta } = await selectMetasPerformanceDetail(pool, url);
    const kpis = buildMetasKpisFromDetailRows(rows);
    return NextResponse.json({
      rows,
      meta,
      kpis: [serializePgRow(kpis)],
    });
  } catch (error) {
    console.error("GET /api/bi/metas-performance/table:", error);
    return NextResponse.json({ error: "Falha ao carregar a tabela de metas." }, { status: 500 });
  }
}
