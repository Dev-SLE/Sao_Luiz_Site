/** GET /api/bi/comissoes/kpis — resumo agregado de comissões (filtro de período via bi.vw_comissoes_base). */
import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectComissoesKpisFromBase } from "@/lib/server/biComissoesRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "comissoes");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "comissoes");
    const pool = getCommercialPool();
    const { rows, meta } = await selectComissoesKpisFromBase(pool, url);
    return NextResponse.json({ rows, periodApplied: meta.periodApplied });
  } catch (error) {
    console.error("GET /api/bi/comissoes/kpis:", error);
    return NextResponse.json(
      { error: "Falha ao ler KPIs de comissões. Verifique COMERCIAL_DATABASE_URL e as views no schema bi." },
      { status: 500 },
    );
  }
}
