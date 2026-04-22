import { NextResponse } from "next/server";
import { requireComercial360ReadFromUrl } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { select360DrillCliente } from "@/lib/server/bi360Read";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guard = await requireComercial360ReadFromUrl(req, url);
  if (guard.denied) return guard.denied;
  try {
    const matchKey = String(url.searchParams.get("match_key") || "").trim();
    if (!matchKey) {
      return NextResponse.json({ error: "Parâmetro match_key é obrigatório." }, { status: 400 });
    }
    const pool = getCommercialPool();
    const rows = await select360DrillCliente(pool, url, matchKey);
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/drill:", error);
    return NextResponse.json({ error: "Falha no drill do cliente." }, { status: 500 });
  }
}
