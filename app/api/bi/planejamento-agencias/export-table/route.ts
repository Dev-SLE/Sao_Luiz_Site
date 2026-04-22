import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import {
  getPlanejamentoAnoMetaDias,
  selectPlanejamentoAgenciasDataset,
} from "@/lib/server/biPlanejamentoAgenciasRead";
import { buildPlanejamentoAgenciasExcelBuffer } from "@/lib/server/buildPlanejamentoAgenciasExcel";

export const runtime = "nodejs";

function safeFilenamePart(s: string): string {
  return s.replace(/[^\d\-a-zA-Z_]/g, "_").slice(0, 40) || "export";
}

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const pool = getCommercialPool();
    const { ready, atual, anoBase, anoAtual } = await selectPlanejamentoAgenciasDataset(pool, url);
    const anoMetaDias = getPlanejamentoAnoMetaDias();
    const buffer = await buildPlanejamentoAgenciasExcelBuffer(ready, atual, url, {
      anoBase,
      anoAtual,
      anoMetaDias,
    });

    const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
    const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
    const filename = `Planejamento_agencias_${safeFilenamePart(from)}_${safeFilenamePart(to)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/bi/planejamento-agencias/export-table:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha." }, { status: 500 });
  }
}
