import { NextResponse } from "next/server";
import { requireOperacionalDesempenhoAgenciasRead } from "@/lib/server/operacionalBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import { selectDesempenhoAgenciasDrill } from "@/lib/server/biDesempenhoAgenciasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireOperacionalDesempenhoAgenciasRead(req);
  if (guard.denied) return guard.denied;
  try {
    const pool = getCommercialPool();
    const url = new URL(req.url);
    const data = await selectDesempenhoAgenciasDrill(pool, url);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /api/bi/desempenho-agencias/drill:", error);
    return NextResponse.json({ error: "Falha ao carregar drill." }, { status: 500 });
  }
}
