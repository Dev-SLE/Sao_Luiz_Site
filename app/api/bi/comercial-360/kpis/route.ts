import { NextResponse } from "next/server";
import { requireComercial360Read } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { select360Kpis } from "@/lib/server/bi360Read";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireComercial360Read(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const pool = getCommercialPool();
    const data = await select360Kpis(pool, url);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/kpis:", error);
    return NextResponse.json({ error: "Falha ao ler KPIs." }, { status: 500 });
  }
}
