import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseTesourariaTableFromUrl, selectTesourariaTransferenciasTable } from "@/lib/server/biTesourariaRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const q = parseTesourariaTableFromUrl(url);
    const pool = getCommercialPool();
    const { rows, total } = await selectTesourariaTransferenciasTable(pool, q);
    return NextResponse.json({
      rows,
      total,
      period: { from: q.from, to: q.to },
      page: { limit: q.limit, offset: q.offset, sort: q.sortColumn, dir: q.sortDir },
    });
  } catch (error) {
    console.error("GET /api/bi/financeiro/tesouraria/transferencias:", error);
    return NextResponse.json({ error: "Falha ao carregar transferências." }, { status: 500 });
  }
}
