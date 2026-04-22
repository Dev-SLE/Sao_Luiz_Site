import { NextResponse } from "next/server";
import { requireOperacionalDesempenhoAgenciasRead } from "@/lib/server/operacionalBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectDesempenhoAgenciasFacetOptions } from "@/lib/server/biDesempenhoAgenciasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireOperacionalDesempenhoAgenciasRead(req);
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "desempenhoAgencias");
    const data = await selectDesempenhoAgenciasFacetOptions(pool, url);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /api/bi/desempenho-agencias/facet-options:", error);
    return NextResponse.json({ error: "Falha ao carregar filtros." }, { status: 500 });
  }
}
