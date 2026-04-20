/**
 * GET /api/bi/comissoes/schema
 * Confere no Postgres (COMERCIAL_DATABASE_URL) as views do BI em `bi` e lista colunas/tipos via information_schema.
 * ?refresh=1 invalida o cache e relê o catálogo.
 */
import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { BI_VIEWS } from "@/lib/server/biComissoesRead";
import { getBiComissoesSchemaCatalog, invalidateBiComissoesSchemaCache } from "@/lib/server/biComissoesIntrospect";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "comissoes");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "comissoes");
    const pool = getCommercialPool();
    const schema = "bi";
    const tables = [...new Set(Object.values(BI_VIEWS).map((fq) => fq.split(".")[1]!).filter(Boolean))];
    const refresh = url.searchParams.get("refresh") === "1";

    if (refresh) invalidateBiComissoesSchemaCache();
    const catalog = await getBiComissoesSchemaCatalog(pool, schema, tables, false);
    return NextResponse.json({
      ok: true,
      refreshed: refresh,
      viewsExpected: BI_VIEWS,
      catalog,
      cacheTtlMsHint: String(process.env.BI_COMISSOES_SCHEMA_CACHE_TTL_MS || "120000"),
    });
  } catch (error) {
    console.error("GET /api/bi/comissoes/schema:", error);
    return NextResponse.json(
      { error: "Falha ao inspecionar schema bi. Verifique COMERCIAL_DATABASE_URL e permissões de leitura no catálogo." },
      { status: 500 },
    );
  }
}
