import { NextResponse } from "next/server";
import { requireComercial360Read } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { select360Tabela } from "@/lib/server/bi360Read";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireComercial360Read(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const pool = getCommercialPool();
    const { rows, meta } = await select360Tabela(pool, url);
    return NextResponse.json({ rows, meta }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/tabela:", error);
    return NextResponse.json({ error: "Falha ao ler tabela." }, { status: 500 });
  }
}
