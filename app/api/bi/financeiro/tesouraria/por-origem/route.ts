import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { parseTesourariaFiltersFromUrl, selectTesourariaPorOrigem } from "@/lib/server/biTesourariaRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const f = parseTesourariaFiltersFromUrl(url);
    const pool = getCommercialPool();
    const rows = await selectTesourariaPorOrigem(pool, f, 15);
    return NextResponse.json({ rows, period: { from: f.from, to: f.to } });
  } catch (error) {
    console.error("GET /api/bi/financeiro/tesouraria/por-origem:", error);
    return NextResponse.json({ error: "Falha ao carregar ranking por conta de origem." }, { status: 500 });
  }
}
