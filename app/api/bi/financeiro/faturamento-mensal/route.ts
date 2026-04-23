import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseFinanceiroFiltersFromUrl, selectFinanceiroFaturamentoMensal } from "@/lib/server/biFinanceiroRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const f = parseFinanceiroFiltersFromUrl(url);
    const pool = getCommercialPool();
    const rows = await selectFinanceiroFaturamentoMensal(pool, f.from, f.to);
    return NextResponse.json({ rows, period: { from: f.from, to: f.to } });
  } catch (error) {
    console.error("GET /api/bi/financeiro/faturamento-mensal:", error);
    return NextResponse.json({ error: "Falha ao carregar faturamento mensal." }, { status: 500 });
  }
}
