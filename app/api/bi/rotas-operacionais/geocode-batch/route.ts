import { NextResponse } from "next/server";
import { requireOperacionalDesempenhoAgenciasRead } from "@/lib/server/operacionalBiAuth";
import { geocodeBrazilCityNamesStable } from "@/lib/server/geocodeBrazilCity";

export const runtime = "nodejs";

type Body = { cities?: unknown };

export async function POST(req: Request) {
  const guard = await requireOperacionalDesempenhoAgenciasRead(req);
  if (guard.denied) return guard.denied;
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const raw = Array.isArray(body.cities) ? body.cities : [];
    const cities = raw
      .map((c) => (typeof c === "string" ? c.trim() : ""))
      .filter((c) => c.length > 0 && c.length <= 160)
      .slice(0, 48);
    if (!cities.length) {
      return NextResponse.json({ coords: {} as Record<string, { lat: number; lng: number } | null> });
    }
    const coords = await geocodeBrazilCityNamesStable(cities, { max: 48 });
    return NextResponse.json(
      { coords },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("POST /api/bi/rotas-operacionais/geocode-batch:", error);
    return NextResponse.json({ error: "Falha ao geocodificar cidades." }, { status: 500 });
  }
}
