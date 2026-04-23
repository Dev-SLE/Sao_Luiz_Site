import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseTesourariaFiltersFromUrl, selectTesourariaResumoMensal } from "@/lib/server/biTesourariaRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const f = parseTesourariaFiltersFromUrl(url);
    const pool = getCommercialPool();
    const rows = await selectTesourariaResumoMensal(pool, f);
    return NextResponse.json({ rows, period: { from: f.from, to: f.to } });
  } catch (error) {
    console.error("GET /api/bi/financeiro/tesouraria/resumo-mensal:", error);
    return NextResponse.json({ error: "Falha ao carregar evolução mensal de transferências." }, { status: 500 });
  }
}
