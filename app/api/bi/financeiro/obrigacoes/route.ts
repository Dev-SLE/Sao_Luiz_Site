import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseFinanceiroTableFromUrl, selectFinanceiroObrigacoesTable } from "@/lib/server/biFinanceiroRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const q = parseFinanceiroTableFromUrl(url);
    const pool = getCommercialPool();
    const { rows, total } = await selectFinanceiroObrigacoesTable(pool, q);
    return NextResponse.json({
      rows,
      total,
      limit: q.limit,
      offset: q.offset,
      sort: q.sortColumn,
      dir: q.sortDir,
      period: { from: q.from, to: q.to },
    });
  } catch (error) {
    console.error("GET /api/bi/financeiro/obrigacoes:", error);
    return NextResponse.json({ error: "Falha ao carregar obrigações." }, { status: 500 });
  }
}
