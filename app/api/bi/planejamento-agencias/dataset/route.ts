import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import {
  getPlanejamentoAnoMetaDias,
  selectPlanejamentoAgenciasDataset,
} from "@/lib/server/biPlanejamentoAgenciasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const pool = getCommercialPool();
    const { ready, atual, anoBase, anoAtual } = await selectPlanejamentoAgenciasDataset(pool, url);
    return NextResponse.json(
      {
        ready,
        atual,
        anoBase,
        anoAtual,
        anoMetaDias: getPlanejamentoAnoMetaDias(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("GET /api/bi/planejamento-agencias/dataset:", error);
    return NextResponse.json({ error: "Falha ao carregar planejamento." }, { status: 500 });
  }
}
