import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseTesourariaFiltersFromUrl, selectTesourariaKpis } from "@/lib/server/biTesourariaRead";

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
    const f = parseTesourariaFiltersFromUrl(url);
    const pool = getCommercialPool();
    const row = await selectTesourariaKpis(pool, f);
    return NextResponse.json({
      totalTransferido: toNum(row.total_transferido),
      totalTesouraria: toNum(row.total_tesouraria),
      totalSuprimento: toNum(row.total_suprimento),
      totalConciliado: toNum(row.total_conciliado),
      qtdTransferencias: Math.round(toNum(row.qtd_transferencias)),
      period: { from: f.from, to: f.to },
    });
  } catch (error) {
    console.error("GET /api/bi/financeiro/tesouraria/kpis:", error);
    return NextResponse.json({ error: "Falha ao carregar indicadores de tesouraria." }, { status: 500 });
  }
}
