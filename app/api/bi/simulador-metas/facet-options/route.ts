import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { selectSimuladorMetasFacetOptions } from "@/lib/server/biSimuladorMetasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const data = await selectSimuladorMetasFacetOptions(pool);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /api/bi/simulador-metas/facet-options:", error);
    return NextResponse.json({ error: "Falha ao carregar filtros." }, { status: 500 });
  }
}
