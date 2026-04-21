import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { selectSimuladorMetasDataset } from "@/lib/server/biSimuladorMetasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "metas");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const pool = getCommercialPool();
    const rows = await selectSimuladorMetasDataset(pool, url);
    return NextResponse.json({ rows }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /api/bi/simulador-metas/dataset:", error);
    return NextResponse.json({ error: "Falha ao carregar dados do simulador." }, { status: 500 });
  }
}
