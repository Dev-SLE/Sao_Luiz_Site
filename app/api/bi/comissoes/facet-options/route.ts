/** GET /api/bi/comissoes/facet-options — listas para filtros a partir de `bi.vw_comissoes_base` (colunas oficiais do módulo). */
import { NextResponse } from "next/server";
import { requireGerencialCommercialDataTab } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { BI_COMISSOES_CONFIG, getBiComissoesVendedorAllowlistUpper } from "@/modules/bi/comissoes/config";
import { getBiComissoesSchemaCatalog } from "@/lib/server/biComissoesIntrospect";
import { collectBaseDimensionFilters } from "@/lib/server/biComissoesRead";

export const runtime = "nodejs";

const BASE = BI_COMISSOES_CONFIG.views.base;

function isSafeIdent(s: string) {
  return /^[a-z][a-z0-9_]{0,62}$/.test(s);
}

export async function GET(req: Request) {
  const guard = await requireGerencialCommercialDataTab(req, "comissoes");
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "comissoes");
    const lockedVendedor = url.searchParams.get(BI_COMISSOES_CONFIG.filters.vendedor);
    const pool = getCommercialPool();
    const catalog = await getBiComissoesSchemaCatalog(pool, "bi", ["vw_comissoes_base"], false);
    const baseNames = catalog.views["vw_comissoes_base"]?.columns.map((c) => c.name) ?? [];
    const L = new Set(baseNames.map((n) => n.toLowerCase()));

    const F = BI_COMISSOES_CONFIG.filters;
    const vcol = L.has(F.vendedor.toLowerCase()) ? baseNames.find((n) => n.toLowerCase() === F.vendedor.toLowerCase())! : null;
    const tcol = L.has(F.tipoComissao.toLowerCase()) ? baseNames.find((n) => n.toLowerCase() === F.tipoComissao.toLowerCase())! : null;
    const tbcol = L.has(F.tabelaNome.toLowerCase()) ? baseNames.find((n) => n.toLowerCase() === F.tabelaNome.toLowerCase())! : null;

    async function distinct(col: string | null) {
      if (!col || !isSafeIdent(col)) return [];
      const parts: string[] = [`${col} IS NOT NULL`, `BTRIM(${col}::text) <> ''`];
      const params: unknown[] = [];
      let n = 1;
      const dateCol = BI_COMISSOES_CONFIG.dateColumn;
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from) && L.has(dateCol.toLowerCase())) {
        const resolved = baseNames.find((name) => name.toLowerCase() === dateCol.toLowerCase());
        if (resolved && isSafeIdent(resolved)) {
          parts.push(`${resolved}::date >= $${n}::date`);
          params.push(from);
          n += 1;
        }
      }
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && L.has(dateCol.toLowerCase())) {
        const resolved = baseNames.find((name) => name.toLowerCase() === dateCol.toLowerCase());
        if (resolved && isSafeIdent(resolved)) {
          parts.push(`${resolved}::date <= $${n}::date`);
          params.push(to);
          n += 1;
        }
      }

      const dimMap = collectBaseDimensionFilters(url);
      for (const [logical, values] of dimMap.entries()) {
        if (!values.length) continue;
        if (logical.toLowerCase() === String(col).toLowerCase()) continue;
        const resolved = baseNames.find((name) => name.toLowerCase() === logical.toLowerCase());
        if (!resolved || !isSafeIdent(resolved)) continue;
        if (values.length === 1) {
          parts.push(`${resolved}::text = $${n}::text`);
          params.push(values[0]);
          n += 1;
        } else {
          parts.push(`${resolved}::text = ANY($${n}::text[])`);
          params.push(values);
          n += 1;
        }
      }

      if (lockedVendedor && vcol && isSafeIdent(vcol)) {
        parts.push(`UPPER(BTRIM(${vcol}::text)) = UPPER($${n}::text)`);
        params.push(lockedVendedor);
        n += 1;
      }
      const allow = getBiComissoesVendedorAllowlistUpper();
      if (!lockedVendedor && allow?.length && vcol && isSafeIdent(vcol)) {
        parts.push(`UPPER(BTRIM(${vcol}::text)) = ANY($${n}::text[])`);
        params.push(allow);
      }
      const where = parts.join(" AND ");
      const r = await pool.query(
        `SELECT DISTINCT ${col}::text AS v FROM ${BASE} WHERE ${where} ORDER BY 1 LIMIT 400`,
        params,
      );
      return (r.rows || []).map((row: { v: unknown }) => String(row.v)).filter((s) => s.length > 0);
    }

    const [vendedores, tipos, tabelas] = await Promise.all([distinct(vcol), distinct(tcol), distinct(tbcol)]);
    return NextResponse.json({
      vendedores,
      tipos,
      tabelas,
      keys: {
        vendedor: vcol ? F.vendedor : null,
        tipo: tcol ? F.tipoComissao : null,
        tabela: tbcol ? F.tabelaNome : null,
      },
    });
  } catch (error) {
    console.error("GET /api/bi/comissoes/facet-options:", error);
    return NextResponse.json({ error: "Não foi possível carregar as opções de filtro." }, { status: 500 });
  }
}
