import { NextResponse } from "next/server";
import { requireOperacionalDesempenhoAgenciasRead } from "@/lib/server/operacionalBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import {
  selectRotasOperacionaisDataset,
  selectRotasOperacionaisExportMovimentos,
} from "@/lib/server/biRotasOperacionaisRead";
import { buildRotasOperacionaisExcelBuffer } from "@/lib/server/buildRotasOperacionaisExcel";

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
    const drillMode = url.searchParams.get("export_drill") === "1";
    const dag = (url.searchParams.get("drill_agencia") || "").trim();
    const dcd = (url.searchParams.get("drill_cidade") || "").trim();
    const dro = (url.searchParams.get("drill_rota") || "").trim();
    const drill =
      drillMode && dag && dcd && dro ? { agencia: dag, cidade: dcd, rota: dro } : null;

    const [{ rows: movimentos, truncated }, dataset] = await Promise.all([
      selectRotasOperacionaisExportMovimentos(pool, url),
      selectRotasOperacionaisDataset(pool, url),
    ]);

    const buffer = await buildRotasOperacionaisExcelBuffer(dataset, movimentos, url, {
      truncated,
      drill,
    });

    const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
    const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
    const suffix = drill ? `_drill_${safeFilenamePart(dag)}_${safeFilenamePart(dcd)}` : "";
    const filename = `Rotas_operacionais_${safeFilenamePart(from)}_${safeFilenamePart(to)}${suffix}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/bi/rotas-operacionais/export-xlsx:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha." }, { status: 500 });
  }
}
