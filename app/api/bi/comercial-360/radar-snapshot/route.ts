import { NextResponse } from "next/server";
import { requireComercial360ReadFromUrl } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { select360RadarSnapshot } from "@/lib/server/bi360Read";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guard = await requireComercial360ReadFromUrl(req, url);
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const data = await select360RadarSnapshot(pool, url);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/radar-snapshot:", error);
    return NextResponse.json({ error: "Falha ao ler radar." }, { status: 500 });
  }
}
