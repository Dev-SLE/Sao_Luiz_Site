import { NextResponse } from "next/server";
import { requireComercial360ReadFromUrl } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { select360EvolucaoMensal } from "@/lib/server/bi360Read";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guard = await requireComercial360ReadFromUrl(req, url);
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const rows = await select360EvolucaoMensal(pool, url);
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/evolucao:", error);
    return NextResponse.json({ error: "Falha ao ler evolução mensal." }, { status: 500 });
  }
}
