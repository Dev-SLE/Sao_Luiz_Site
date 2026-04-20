/** GET /api/bi/comissoes/ranking — dados para desempenho por vendedor. */
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
    const { rows, meta } = await selectBiView(pool, "ranking", url, {
      defaultLimit: 200,
      maxLimit: 2000,
    });
    return NextResponse.json({ rows, periodApplied: meta.periodApplied });
  } catch (error) {
    console.error("GET /api/bi/comissoes/ranking:", error);
    return NextResponse.json(
      { error: "Falha ao ler ranking de comissões." },
      { status: 500 },
    );
  }
}
