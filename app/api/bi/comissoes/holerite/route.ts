/**
 * GET /api/bi/comissoes/holerite — linhas detalhadas em `bi.vw_comissoes_base` para impressão do holerite.
 * Permissão: `module.gerencial.comissoes_holerite` ou `module.gerencial.view` (OR).
 */
import { NextResponse } from "next/server";
import { requireGerencialComissoesHolerite } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectBiView } from "@/lib/server/biComissoesRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialComissoesHolerite(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "comissoes");
    const pool = getCommercialPool();
    const { rows, meta } = await selectBiView(pool, "base", url, {
      defaultLimit: 5000,
      maxLimit: 10000,
      hardLimit: 15000,
    });
    return NextResponse.json({
      document: "holerite_comissoes",
      rows,
      periodApplied: meta.periodApplied,
    });
  } catch (error) {
    console.error("GET /api/bi/comissoes/holerite:", error);
    return NextResponse.json({ error: "Falha ao montar dados do holerite." }, { status: 500 });
  }
}
