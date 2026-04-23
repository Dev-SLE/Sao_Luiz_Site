import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import {
  parseFinanceiroFiltersFromUrl,
  previousInclusiveRange,
  selectFinanceiroFaturadoTotal,
  selectFinanceiroKpisObrigacoes,
} from "@/lib/server/biFinanceiroRead";

export const runtime = "nodejs";

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const f = parseFinanceiroFiltersFromUrl(url);
    const { prevFrom, prevTo } = previousInclusiveRange(f.from, f.to);
    const pool = getCommercialPool();
    const [curO, prevO, fatCur, fatPrev] = await Promise.all([
      selectFinanceiroKpisObrigacoes(pool, f),
      selectFinanceiroKpisObrigacoes(pool, { ...f, from: prevFrom, to: prevTo }),
      selectFinanceiroFaturadoTotal(pool, f.from, f.to),
      selectFinanceiroFaturadoTotal(pool, prevFrom, prevTo),
    ]);
    const current = {
      totalEmAberto: toNum(curO.total_em_aberto),
      totalLiquidado: toNum(curO.total_liquidado),
      totalVencido: toNum(curO.total_vencido),
      totalFaturado: fatCur,
    };
    const previous = {
      totalEmAberto: toNum(prevO.total_em_aberto),
      totalLiquidado: toNum(prevO.total_liquidado),
      totalVencido: toNum(prevO.total_vencido),
      totalFaturado: fatPrev,
    };
    return NextResponse.json({
      current,
      previous,
      period: { from: f.from, to: f.to, prevFrom, prevTo },
    });
  } catch (error) {
    console.error("GET /api/bi/financeiro/kpis:", error);
    return NextResponse.json({ error: "Falha ao carregar indicadores financeiros." }, { status: 500 });
  }
}
