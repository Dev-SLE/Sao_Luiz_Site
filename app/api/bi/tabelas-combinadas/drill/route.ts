import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { resolveTcPeriod, selectTcDrill } from "@/lib/server/biTabelasCombinadasRead";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "carteira");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    const cliente = String(url.searchParams.get("cliente") || "").trim();
    if (!cliente) {
      return NextResponse.json({ error: "Informe o cliente para o detalhe." }, { status: 400 });
    }
    applyGerencialBiScopeToUrl(url, guard.session, "carteira");
    const pool = getCommercialPool();
    const rows = await selectTcDrill(pool, url, cliente);
    return NextResponse.json({ rows, cliente, periodApplied: resolveTcPeriod(url) });
  } catch (error) {
    console.error("GET /api/bi/tabelas-combinadas/drill:", error);
    return NextResponse.json({ error: "Falha ao carregar detalhe do cliente." }, { status: 500 });
  }
}
