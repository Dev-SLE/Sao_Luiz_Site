import { NextResponse } from "next/server";
import { requireFinanceiroBiRead } from "@/lib/server/financeiroBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { selectTesourariaFacetOptions } from "@/lib/server/biTesourariaRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireFinanceiroBiRead(req);
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const data = await selectTesourariaFacetOptions(pool);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/bi/financeiro/tesouraria/facet-options:", error);
    return NextResponse.json({ error: "Falha ao carregar opções de filtro." }, { status: 500 });
  }
}
