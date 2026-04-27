/**
 * BI Funil de Vendas — leitura no Neon (COMERCIAL_DATABASE_URL, schema `bi`).
 * Agregações a partir de `bi.vw_funil_vendas_base` com período e filtros, espelhando as views do schema.
 */
import type { Pool } from "pg";
import type { BiSchemaCatalog } from "@/lib/server/biComissoesIntrospect";
import { getBiComissoesSchemaCatalog } from "@/lib/server/biComissoesIntrospect";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { getBiComissoesVendedorAllowlistUpper } from "@/modules/bi/comissoes/config";
import { BI_FUNIL_VENDAS_CONFIG } from "@/modules/bi/funilVendas/config";

const MAIN_ALIAS = "t";
const BASE_REL = "vw_funil_vendas_base";
const DATE_COL = BI_FUNIL_VENDAS_CONFIG.dateColumn;
const RESERVED = new Set([
  "from",
  "to",
  "limit",
  "offset",
  "refresh",
  "search",
  BI_FUNIL_VENDAS_CONFIG.filters.cotIdPesquisaSistema,
  BI_FUNIL_VENDAS_CONFIG.filters.cteSerie,
  BI_FUNIL_VENDAS_CONFIG.filters.cteNumero,
]);

/** Parâmetros de URL → coluna física em `vw_funil_vendas_base` (igualdade / ANY). */
const URL_TO_BASE_COL: Record<string, string> = {
  [BI_FUNIL_VENDAS_CONFIG.filters.statusFunil]: BI_FUNIL_VENDAS_CONFIG.baseStatusColumn,
  [BI_FUNIL_VENDAS_CONFIG.filters.vendedor]: "vendedor",
};

const BASE_FILTER_KEYS = new Set(Object.keys(URL_TO_BASE_COL));

function isSafeIdent(s: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/.test(s);
}

function columnExists(catalog: BiSchemaCatalog, tableName: string, col: string): boolean {
  const cols = catalog.views[tableName]?.columns ?? [];
  return cols.some((c) => c.name.toLowerCase() === col.toLowerCase());
}

function resolveColumnName(catalog: BiSchemaCatalog, tableName: string, logical: string): string | null {
  const cols = catalog.views[tableName]?.columns ?? [];
  const hit = cols.find((c) => c.name.toLowerCase() === logical.toLowerCase());
  return hit?.name ?? null;
}

function pushTextEqOrAnyAnd(parts: string[], values: unknown[], sqlExpr: string, vals: string[]) {
  if (!vals.length) return;
  if (vals.length === 1) {
    values.push(vals[0]);
    parts.push(`AND ${sqlExpr}::text = $${values.length}::text`);
  } else {
    values.push(vals);
    parts.push(`AND ${sqlExpr}::text = ANY($${values.length}::text[])`);
  }
}

export function collectFunilDimensionFilters(url: URL): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [key, val] of url.searchParams.entries()) {
    const rawK = key.toLowerCase();
    if (RESERVED.has(rawK)) continue;
    if (!BASE_FILTER_KEYS.has(key)) continue;
    if (val === "") continue;
    const arr = m.get(key) ?? [];
    if (!arr.includes(val)) arr.push(val);
    m.set(key, arr);
  }
  return m;
}

export type FunilQueryMeta = { periodApplied: boolean };

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/** ILIKE em colunas visíveis da tabela (após JOIN com tabela de frete). */
function appendTabelaTextSearch(url: URL, values: unknown[], parts: string[], rowAlias: string): void {
  const raw = url.searchParams.get("search")?.trim();
  if (!raw) return;
  const safe = `%${raw.replace(/%/g, "").replace(/_/g, "").slice(0, 200)}%`;
  if (!safe || safe === "%%") return;
  values.push(safe);
  const i = values.length;
  parts.push(`AND (
    ${rowAlias}.cot_numero_interno::text ILIKE $${i}::text
    OR COALESCE(${rowAlias}.cot_id_pesquisa_sistema::text, '') ILIKE $${i}::text
    OR COALESCE(${rowAlias}.cte_serie::text, '') ILIKE $${i}::text
    OR COALESCE(${rowAlias}.cte_numero::text, '') ILIKE $${i}::text
    OR COALESCE(${rowAlias}.cliente_remetente::text, '') ILIKE $${i}::text
    OR COALESCE(${rowAlias}.vendedor::text, '') ILIKE $${i}::text
    OR COALESCE(tf.descricao::text, '') ILIKE $${i}::text
    OR COALESCE(${rowAlias}.status_funil_padronizado::text, '') ILIKE $${i}::text
  )`);
}

/** Filtros dedicados (ILIKE parcial) — parâmetros fora de `URL_TO_BASE_COL`. */
function appendFunilIlikeColumnFilters(
  url: URL,
  catalog: BiSchemaCatalog,
  parts: string[],
  values: unknown[],
) {
  const specs: { param: string; logical: string }[] = [
    { param: BI_FUNIL_VENDAS_CONFIG.filters.cotIdPesquisaSistema, logical: "cot_id_pesquisa_sistema" },
    { param: BI_FUNIL_VENDAS_CONFIG.filters.cteSerie, logical: "cte_serie" },
    { param: BI_FUNIL_VENDAS_CONFIG.filters.cteNumero, logical: "cte_numero" },
  ];
  for (const { param, logical } of specs) {
    const rawVals = url.searchParams.getAll(param).map((s) => s.trim()).filter(Boolean);
    if (!rawVals.length) continue;
    if (!columnExists(catalog, BASE_REL, logical)) continue;
    const sqlCol = resolveColumnName(catalog, BASE_REL, logical)!;
    const ors: string[] = [];
    for (const raw of rawVals) {
      const safe = `%${raw.replace(/%/g, "").replace(/_/g, "").slice(0, 200)}%`;
      if (safe === "%%") continue;
      values.push(safe);
      ors.push(`COALESCE(${MAIN_ALIAS}.${sqlCol}::text, '') ILIKE $${values.length}::text`);
    }
    if (ors.length) parts.push(`AND (${ors.join(" OR ")})`);
  }
}

function appendFunilVendedorAllowlist(parts: string[], values: unknown[]): void {
  const allow = getBiComissoesVendedorAllowlistUpper();
  if (!allow?.length) return;
  values.push(allow);
  parts.push(`AND upper(btrim(${MAIN_ALIAS}.vendedor::text)) = ANY($${values.length}::text[])`);
}

function buildScopedWhere(
  url: URL,
  catalog: BiSchemaCatalog,
): { cteFilterSql: string; values: unknown[]; periodApplied: boolean } {
  const values: unknown[] = [];
  const parts: string[] = [];
  let periodApplied = false;

  const dcol = resolveColumnName(catalog, BASE_REL, DATE_COL);
  if (!dcol) {
    throw new Error(`BI Funil: a view base precisa expor a coluna ${DATE_COL}.`);
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromOk = Boolean(from && /^\d{4}-\d{2}-\d{2}$/.test(from));
  const toOk = Boolean(to && /^\d{4}-\d{2}-\d{2}$/.test(to));

  if (fromOk) {
    values.push(from);
    parts.push(`AND ${MAIN_ALIAS}.${dcol}::date >= $${values.length}::date`);
    periodApplied = true;
  }
  if (toOk) {
    values.push(to);
    parts.push(`AND ${MAIN_ALIAS}.${dcol}::date <= $${values.length}::date`);
    periodApplied = true;
  }

  const dimMap = collectFunilDimensionFilters(url);
  for (const [paramKey, vals] of dimMap) {
    const baseLogical = URL_TO_BASE_COL[paramKey];
    if (!baseLogical || !vals.length) continue;
    if (!columnExists(catalog, BASE_REL, baseLogical)) continue;
    const sqlCol = resolveColumnName(catalog, BASE_REL, baseLogical)!;

    pushTextEqOrAnyAnd(parts, values, `${MAIN_ALIAS}.${sqlCol}`, vals);
  }

  appendFunilIlikeColumnFilters(url, catalog, parts, values);
  appendFunilVendedorAllowlist(parts, values);

  return { cteFilterSql: parts.join(" "), values, periodApplied };
}

function scopedCte(catalog: BiSchemaCatalog, url: URL): { sql: string; values: unknown[]; meta: FunilQueryMeta } {
  const baseFqn = BI_FUNIL_VENDAS_CONFIG.views.base;
  const { cteFilterSql, values, periodApplied } = buildScopedWhere(url, catalog);
  const sql = `WITH scoped AS ( SELECT ${MAIN_ALIAS}.* FROM ${baseFqn} ${MAIN_ALIAS} WHERE 1=1 ${cteFilterSql} )`;
  return { sql, values, meta: { periodApplied } };
}

export async function selectFunilKpis(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) {
    throw new Error(`BI Funil: relação bi.${BASE_REL} não encontrada no catálogo.`);
  }
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const q = `
    ${cte}
    SELECT
      count(*)::bigint AS qtd_cotacoes_totais,
      count(*) FILTER (WHERE status_funil_padronizado = 'EM NEGOCIACAO'::text)::bigint AS em_negociacao,
      count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text)::bigint AS qtd_vendas_fechadas,
      CASE WHEN count(*) = 0 THEN 0::numeric
        ELSE (count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text))::numeric / nullif(count(*)::numeric, 0)
      END AS conversao_global,
      coalesce(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado_total,
      coalesce(sum(cte_valor_faturado) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text), 0::numeric) AS valor_fechado_total
    FROM scoped
  `;
  const res = await pool.query(q, values);
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  return { rows: row ? [serializePgRow(row)] : [serializePgRow({})], meta };
}

export async function selectFunilFunilStatus(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const q = `
    ${cte}
    SELECT
      CASE status_funil_padronizado
        WHEN 'EM NEGOCIACAO'::text THEN 1
        WHEN 'VENDA FECHADA'::text THEN 2
        WHEN 'PERDIDO (EXPIRADO)'::text THEN 3
        WHEN 'VENDA CANCELADA'::text THEN 4
        ELSE 99
      END AS ordem_etapa,
      status_funil_padronizado AS etapa,
      count(*)::bigint AS qtd_registros,
      coalesce(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado,
      coalesce(sum(cte_valor_faturado), 0::numeric) AS valor_fechado,
      CASE WHEN count(*) = 0 THEN 0::numeric
        ELSE coalesce(sum(cte_valor_faturado), 0::numeric) / count(*)::numeric
      END AS ticket_medio_fechado
    FROM scoped
    GROUP BY status_funil_padronizado
    ORDER BY 1
  `;
  const res = await pool.query(q, values);
  const rows = (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>));
  return { rows, meta };
}

export async function selectFunilConversaoVendedor(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const q = `
    ${cte}
    SELECT
      vendedor,
      count(*)::bigint AS qtd_total,
      count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text)::bigint AS qtd_fechadas,
      CASE WHEN count(*) = 0 THEN 0::numeric
        ELSE (count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text))::numeric / count(*)::numeric
      END AS conversao
    FROM scoped
    WHERE vendedor IS NOT NULL AND btrim(vendedor::text) <> ''
    GROUP BY vendedor
    ORDER BY vendedor
  `;
  const res = await pool.query(q, values);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

export async function selectFunilValorFechadoVendedor(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const q = `
    ${cte}
    SELECT vendedor, coalesce(sum(cte_valor_faturado), 0::numeric) AS valor_fechado
    FROM scoped
    WHERE status_funil_padronizado = 'VENDA FECHADA'::text
      AND vendedor IS NOT NULL AND btrim(vendedor::text) <> ''
    GROUP BY vendedor
    ORDER BY vendedor
  `;
  const res = await pool.query(q, values);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

export async function selectFunilQtdFechadaVendedor(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const q = `
    ${cte}
    SELECT vendedor, count(*)::bigint AS qtd_fechada
    FROM scoped
    WHERE status_funil_padronizado = 'VENDA FECHADA'::text
      AND vendedor IS NOT NULL AND btrim(vendedor::text) <> ''
    GROUP BY vendedor
    ORDER BY vendedor
  `;
  const res = await pool.query(q, values);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

export async function selectFunilEvolucaoMensal(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const q = `
    ${cte}
    SELECT
      ano,
      mes_num,
      mes_nome,
      mes_ano,
      count(*)::bigint AS qtd_cotacoes,
      count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text)::bigint AS qtd_fechadas,
      count(*) FILTER (WHERE status_funil_padronizado = 'EM NEGOCIACAO'::text)::bigint AS qtd_negociacao,
      coalesce(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado,
      coalesce(sum(cte_valor_faturado) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text), 0::numeric) AS valor_fechado
    FROM scoped
    GROUP BY ano, mes_num, mes_nome, mes_ano
    ORDER BY ano, mes_num
  `;
  const res = await pool.query(q, values);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

export async function selectFunilTabela(
  pool: Pool,
  url: URL,
  opts?: { defaultLimit?: number; maxLimit?: number; forceSchemaRefresh?: boolean },
) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const defaultLimit = opts?.defaultLimit ?? 500;
  const maxLimit = opts?.maxLimit ?? 3000;
  const limRaw = Number(url.searchParams.get("limit") || defaultLimit);
  const offRaw = Number(url.searchParams.get("offset") || 0);
  const limit = clampInt(limRaw, 1, maxLimit);
  const offset = clampInt(offRaw, 0, 50_000);
  const outerParts: string[] = [];
  appendTabelaTextSearch(url, values, outerParts, "x");
  const outerWhere = outerParts.join(" ");
  const li = values.length + 1;
  const oi = values.length + 2;
  const q = `
    ${cte}
    SELECT
      x.cot_id_pesquisa_sistema::text AS cot_id_pesquisa_sistema,
      x.cte_numero AS numero_cte,
      COALESCE(x.cte_serie::text, '') AS cte_serie,
      x.cot_data_criacao AS data_cotacao,
      x.cliente_remetente AS cliente,
      x.vendedor,
      COALESCE(tf.descricao, CASE WHEN x.cot_id_tabela IS NOT NULL THEN 'Tabela #' || x.cot_id_tabela::text ELSE '' END) AS nome_tabela,
      x.cot_valor_bruto_real AS valor_cotacao,
      x.status_funil_padronizado AS status
    FROM scoped x
    LEFT JOIN bd_tabelas_frete tf ON tf.id_tabela_frete = x.cot_id_tabela
    WHERE 1=1 ${outerWhere}
    ORDER BY x.cot_data_criacao DESC NULLS LAST
    LIMIT $${li}::int OFFSET $${oi}::int
  `;
  const res = await pool.query(q, [...values, limit, offset]);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

/** Exportação: até 15k linhas, mesmos filtros/período/busca da tela. */
export async function selectFunilTabelaExportRows(
  pool: Pool,
  url: URL,
  opts?: { forceSchemaRefresh?: boolean; maxRows?: number },
) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  const maxRows = clampInt(opts?.maxRows ?? 15_000, 1, 25_000);
  const outerParts: string[] = [];
  appendTabelaTextSearch(url, values, outerParts, "x");
  const outerWhere = outerParts.join(" ");
  const li = values.length + 1;
  const q = `
    ${cte}
    SELECT
      x.cot_id_pesquisa_sistema::text AS cot_id_pesquisa_sistema,
      x.cte_numero AS numero_cte,
      COALESCE(x.cte_serie::text, '') AS cte_serie,
      x.cot_data_criacao AS data_cotacao,
      x.cliente_remetente AS cliente,
      x.vendedor,
      COALESCE(tf.descricao, CASE WHEN x.cot_id_tabela IS NOT NULL THEN 'Tabela #' || x.cot_id_tabela::text ELSE '' END) AS nome_tabela,
      x.cot_valor_bruto_real AS valor_cotacao,
      x.status_funil_padronizado AS status
    FROM scoped x
    LEFT JOIN bd_tabelas_frete tf ON tf.id_tabela_frete = x.cot_id_tabela
    WHERE 1=1 ${outerWhere}
    ORDER BY x.cot_data_criacao DESC NULLS LAST
    LIMIT $${li}::int
  `;
  const res = await pool.query(q, [...values, maxRows]);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

export async function selectFunilDrillVendedor(
  pool: Pool,
  url: URL,
  vendedor: string,
  opts?: { forceSchemaRefresh?: boolean },
) {
  const v = String(vendedor || "").trim();
  if (!v) return { rows: [], meta: { periodApplied: false } as FunilQueryMeta };
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { sql: cte, values, meta } = scopedCte(catalog, url);
  values.push(v);
  const vi = values.length;
  const q = `
    ${cte}
    SELECT
      vendedor,
      status_funil_padronizado AS status_funil,
      count(*)::bigint AS qtd_registros,
      coalesce(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado,
      coalesce(sum(cte_valor_faturado), 0::numeric) AS valor_fechado,
      min(cot_data_criacao)::date AS primeira_cotacao,
      max(cot_data_criacao)::date AS ultima_cotacao
    FROM scoped
    WHERE vendedor IS NOT NULL AND upper(btrim(vendedor::text)) = upper(btrim($${vi}::text))
    GROUP BY vendedor, status_funil_padronizado
    ORDER BY status_funil_padronizado
  `;
  const res = await pool.query(q, values);
  return { rows: (res.rows || []).map((r) => serializePgRow(r as Record<string, unknown>)), meta };
}

/** Opções de facet no período (e demais filtros já aplicados na URL). */
export async function selectFunilFacetOptions(pool: Pool, url: URL, opts?: { forceSchemaRefresh?: boolean }) {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) throw new Error(`BI Funil: bi.${BASE_REL} ausente.`);
  const { cteFilterSql, values } = buildScopedWhere(url, catalog);
  const baseFqn = BI_FUNIL_VENDAS_CONFIG.views.base;

  async function distinctCol(logical: string): Promise<string[]> {
    if (!columnExists(catalog, BASE_REL, logical)) return [];
    const col = resolveColumnName(catalog, BASE_REL, logical)!;
    if (!isSafeIdent(col)) return [];
    const q = `
      SELECT DISTINCT ${MAIN_ALIAS}.${col}::text AS v
      FROM ${baseFqn} ${MAIN_ALIAS}
      WHERE 1=1 ${cteFilterSql}
        AND ${MAIN_ALIAS}.${col} IS NOT NULL
        AND btrim(${MAIN_ALIAS}.${col}::text) <> ''
      ORDER BY 1
      LIMIT 400
    `;
    const r = await pool.query(q, values);
    return (r.rows || []).map((row: { v: unknown }) => String(row.v)).filter((s) => s.length > 0);
  }

  const F = BI_FUNIL_VENDAS_CONFIG.filters;
  const statusCol = BI_FUNIL_VENDAS_CONFIG.baseStatusColumn;

  const [statuses, vendedores] = await Promise.all([distinctCol(statusCol), distinctCol("vendedor")]);

  return {
    status_funil: statuses,
    vendedores,
    keys: {
      status_funil: F.statusFunil,
      vendedor: F.vendedor,
      cot_id_pesquisa_sistema: F.cotIdPesquisaSistema,
      cte_serie: F.cteSerie,
      cte_numero: F.cteNumero,
    },
  };
}
