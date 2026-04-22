import { NextResponse } from "next/server";
import { requireOperacionalDesempenhoAgenciasRead } from "@/lib/server/operacionalBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import {
  selectDesempenhoAgenciasDataset,
  selectDesempenhoAgenciasExportMovimentos,
} from "@/lib/server/biDesempenhoAgenciasRead";
import { buildDesempenhoAgenciasExcelBuffer } from "@/lib/server/buildDesempenhoAgenciasExcel";

export const runtime = "nodejs";

function safeFilenamePart(s: string): string {
  return s.replace(/[^\d\-a-zA-Z_]/g, "_").slice(0, 40) || "export";
}

export async function GET(req: Request) {
  const guard = await requireOperacionalDesempenhoAgenciasRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const pool = getCommercialPool();
    const [{ table }, { rows: movimentos, truncated }] = await Promise.all([
      selectDesempenhoAgenciasDataset(pool, url),
      selectDesempenhoAgenciasExportMovimentos(pool, url),
    ]);
    const buffer = await buildDesempenhoAgenciasExcelBuffer(table, movimentos, url, { truncated });

    const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
    const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
    const foco = url.searchParams.get("agencia_foco")?.trim();
    const suffix = foco ? `_${safeFilenamePart(foco)}` : "";
    const filename = `Desempenho_agencias_${safeFilenamePart(from)}_${safeFilenamePart(to)}${suffix}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/bi/desempenho-agencias/export-xlsx:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha." }, { status: 500 });
  }
}
