import { NextResponse } from "next/server";
import { requireComercial360ReadFromUrl } from "@/lib/server/gerencialBiAuth";
import { getCommercialPool } from "@/lib/server/db";
import {
  select360ResumoCategoria,
  select360ResumoContrato,
  select360ResumoDocumento,
  select360ResumoStatus,
} from "@/lib/server/bi360Read";

export const runtime = "nodejs";

const TIPOS = new Set(["contrato", "documento", "categoria", "status"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guard = await requireComercial360ReadFromUrl(req, url);
  if (guard.denied) return guard.denied;
  try {
    const tipo = String(url.searchParams.get("tipo") || "").toLowerCase();
    if (!TIPOS.has(tipo)) {
      return NextResponse.json(
        { error: "Use ?tipo=contrato|documento|categoria|status" },
        { status: 400 },
      );
    }
    const pool = getCommercialPool();
    if (tipo === "contrato") {
      const rows = await select360ResumoContrato(pool, url);
      return NextResponse.json({ tipo, rows }, { headers: { "Cache-Control": "no-store" } });
    }
    if (tipo === "documento") {
      const rows = await select360ResumoDocumento(pool, url);
      return NextResponse.json({ tipo, rows }, { headers: { "Cache-Control": "no-store" } });
    }
    if (tipo === "categoria") {
      const rows = await select360ResumoCategoria(pool, url);
      return NextResponse.json({ tipo, rows }, { headers: { "Cache-Control": "no-store" } });
    }
    const rows = await select360ResumoStatus(pool, url);
    return NextResponse.json({ tipo, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/bi/comercial-360/resumo:", error);
    return NextResponse.json({ error: "Falha ao ler resumo." }, { status: 500 });
  }
}
