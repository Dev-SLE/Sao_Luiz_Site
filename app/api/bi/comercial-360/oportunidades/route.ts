import { NextResponse } from "next/server";
import { requireComercial360ReadFromUrl } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { select360Oportunidades, select360OportunidadesOrdered } from "@/lib/server/bi360Read";
import { BI_COMERCIAL_360_CONFIG } from "@/modules/bi/comercial360/config";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guard = await requireComercial360ReadFromUrl(req, url);
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const mode = (url.searchParams.get("mode") || "page").toLowerCase();
    if (mode === "top") {
      const order = url.searchParams.get("order") === "gap" ? "gap" : "score";
      const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") || 24) || 24));
      const rows = await select360OportunidadesOrdered(pool, url, order, limit);
      return NextResponse.json({ rows, meta: { mode: "top", order, limit } }, { headers: { "Cache-Control": "no-store" } });
    }
    const limit = Math.min(
      BI_COMERCIAL_360_CONFIG.tableMaxLimit,
      Math.max(1, Number(url.searchParams.get("limit") || BI_COMERCIAL_360_CONFIG.tableDefaultLimit) || 1),
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
    const { rows, total } = await select360Oportunidades(pool, url, limit, offset);
    return NextResponse.json({ rows, meta: { limit, offset, total } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/oportunidades:", error);
    return NextResponse.json({ error: "Falha ao listar oportunidades." }, { status: 500 });
  }
}
