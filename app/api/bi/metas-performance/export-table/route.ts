import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { resolveMetasPeriodIso, selectMetasPerformanceDetail } from "@/lib/server/biMetasPerformanceRead";
import { buildMetasPerformanceExcelBuffer } from "@/lib/server/buildMetasPerformanceExcel";

export const runtime = "nodejs";

function safeFilenamePart(s: string): string {
  return s.replace(/[^\d\-a-zA-Z_]/g, "_").slice(0, 40) || "export";
}

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "metas");
    const pool = getCommercialPool();
    const { rows } = await selectMetasPerformanceDetail(pool, url);
    const buffer = await buildMetasPerformanceExcelBuffer(rows, url);

    const { from, to } = resolveMetasPeriodIso(url);
    const filename = `Metas_performance_${safeFilenamePart(from)}_${safeFilenamePart(to)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/bi/metas-performance/export-table:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha." }, { status: 500 });
  }
}
