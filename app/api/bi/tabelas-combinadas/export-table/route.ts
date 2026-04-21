import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectTcTableExportRows } from "@/lib/server/biTabelasCombinadasRead";
import { buildTabelasCombinadasExcelBuffer } from "@/lib/server/buildTabelasCombinadasExcel";
import { BI_TABELAS_COMBINADAS_CONFIG } from "@/modules/bi/tabelasCombinadas/config";

export const runtime = "nodejs";

function safeFilenamePart(s: string): string {
  return s.replace(/[^\d\-a-zA-Z_]/g, "_").slice(0, 40) || "export";
}

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "carteira");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "carteira");
    const pool = getCommercialPool();
    const { rows } = await selectTcTableExportRows(pool, url, {
      maxRows: BI_TABELAS_COMBINADAS_CONFIG.exportMaxRows,
    });
    const buffer = await buildTabelasCombinadasExcelBuffer(rows, url);

    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const base = ["Carteira_renovacao", safeFilenamePart(from), safeFilenamePart(to)];
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
    console.error("GET /api/bi/tabelas-combinadas/export-table:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha." }, { status: 500 });
  }
}
