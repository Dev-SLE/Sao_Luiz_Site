import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { listAgenciasLookup, listCategorias, listCentrosCusto, listResponsaveis } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") || "all").toLowerCase();
  const pool = getPool();
  if (kind === "agencias") {
    const agencias = await listAgenciasLookup(pool);
    return NextResponse.json({ agencias });
  }
  if (kind === "categorias") {
    const categorias = await listCategorias(pool);
    return NextResponse.json({ categorias });
  }
  if (kind === "centros") {
    const centros = await listCentrosCusto(pool);
    return NextResponse.json({ centros });
  }
  if (kind === "responsaveis") {
    const responsaveis = await listResponsaveis(pool);
    return NextResponse.json({ responsaveis });
  }
  const [agencias, categorias, centros, responsaveis] = await Promise.all([
    listAgenciasLookup(pool),
    listCategorias(pool),
    listCentrosCusto(pool),
    listResponsaveis(pool),
  ]);
  return NextResponse.json({ agencias, categorias, centros, responsaveis });
}
