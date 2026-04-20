/** GET /api/bi/comissoes/filters — legado; preferir /api/bi/comissoes/facet-options na UI. */
import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectBiView } from "@/lib/server/biComissoesRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "comissoes");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "comissoes");
    const pool = getCommercialPool();
    const { rows, meta } = await selectBiView(pool, "filters", url, {
      defaultLimit: 5000,
      maxLimit: 10000,
      includePeriod: false,
    });
    return NextResponse.json({ rows, periodApplied: meta.periodApplied });
  } catch (error) {
    console.error("GET /api/bi/comissoes/filters:", error);
    return NextResponse.json({ error: "Falha ao ler filtros de comissões." }, { status: 500 });
  }
}
