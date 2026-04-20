import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectFunilTabelaExportRows } from "@/lib/server/biFunilVendasRead";
import { buildFunilVendasExcelBuffer } from "@/lib/server/buildFunilVendasExcel";
import { BI_FUNIL_VENDAS_CONFIG } from "@/modules/bi/funilVendas/config";

export const runtime = "nodejs";

function safeFilenamePart(s: string): string {
  return s.replace(/[^\d\-a-zA-Z_]/g, "_").slice(0, 40) || "export";
}

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "funil");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "funil");
    const pool = getCommercialPool();
    const { rows } = await selectFunilTabelaExportRows(pool, url, { maxRows: 15_000 });
    const buffer = await buildFunilVendasExcelBuffer(pool, rows, url);

    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const v0 = url.searchParams.getAll(BI_FUNIL_VENDAS_CONFIG.filters.vendedor).filter(Boolean)[0];
    const base = ["Performance_vendas", safeFilenamePart(from), safeFilenamePart(to)];
    if (v0) base.push(safeFilenamePart(v0));
    const filename = `${base.join("_")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/bi/funil-vendas/export-table:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha." }, { status: 500 });
  }
}
