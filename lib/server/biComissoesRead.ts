/**
 * BI Comissões — leitura read-only (COMERCIAL_DATABASE_URL, schema bi).
 *
 * Período (?from= / ?to=): coluna oficial `data_referencia` em `bi.vw_comissoes_base`
 * (definida em `modules/bi/comissoes/config.ts`).
 *
 * Filtros dimensionais: repetir o mesmo parâmetro (`?vendedor_final=a&vendedor_final=b`) ou um valor único;
 * no SQL viram `= $n` ou `= ANY($n::text[])`.
 */
import type { Pool } from "pg";
import type { BiSchemaCatalog } from "@/lib/server/biComissoesIntrospect";
import { getBiComissoesSchemaCatalog } from "@/lib/server/biComissoesIntrospect";
import {
  BI_COMISSOES_CONFIG,
  BI_COMISSOES_BASE_FILTER_COLUMNS,
  getBiComissoesVendedorAllowlistUpper,
} from "@/modules/bi/comissoes/config";

export const BI_VIEWS = {
  kpis: BI_COMISSOES_CONFIG.views.kpis,
  ranking: BI_COMISSOES_CONFIG.views.ranking,
  table: BI_COMISSOES_CONFIG.views.tabela,
  filters: BI_COMISSOES_CONFIG.views.filters,
  drill: BI_COMISSOES_CONFIG.views.drill,
  base: BI_COMISSOES_CONFIG.views.base,
} as const;

export type BiComissoesViewKey = keyof typeof BI_VIEWS;

const MAIN_ALIAS = "t";
const DATE_COL = BI_COMISSOES_CONFIG.dateColumn;

const RESERVED_PARAMS = new Set(["from", "to", "limit", "offset", "refresh"]);

/** Parâmetros de igualdade aceitos na query (?vendedor_final=…); `vendedor` é alias de `vendedor_final`. */
export const BI_COMISSOES_EQ_FILTER_KEYS = new Set<string>([
  ...BI_COMISSOES_BASE_FILTER_COLUMNS,
  "vendedor",
]);

function isSafeIdent(s: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/.test(s);
}

function normalizeFilterParamKey(key: string): string | null {
  const k = key.toLowerCase().trim();
  if (k === "vendedor") return BI_COMISSOES_CONFIG.filters.vendedor;
  if (BI_COMISSOES_BASE_FILTER_COLUMNS.has(k)) return k;
  return null;
}

/** Valores por coluna lógica da base (já normalizados). */
export function collectBaseDimensionFilters(url: URL): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [key, val] of url.searchParams.entries()) {
    const rawK = key.toLowerCase();
    if (RESERVED_PARAMS.has(rawK)) continue;
    const nk = normalizeFilterParamKey(key);
    if (!nk || val === "" || !BI_COMISSOES_BASE_FILTER_COLUMNS.has(nk)) continue;
    const arr = m.get(nk) ?? [];
    if (!arr.includes(val)) arr.push(val);
    m.set(nk, arr);
  }
  return m;
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

/** Condições dentro de `EXISTS` (sem prefixo AND — unidas depois por ` AND `). */
function pushTextEqOrAnyInner(inner: string[], values: unknown[], sqlExpr: string, vals: string[]) {
  if (!vals.length) return;
  if (vals.length === 1) {
    values.push(vals[0]);
    inner.push(`${sqlExpr}::text = $${values.length}::text`);
  } else {
    values.push(vals);
    inner.push(`${sqlExpr}::text = ANY($${values.length}::text[])`);
  }
}

export function serializeCell(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" && !Number.isFinite(v)) return null;
  return v;
}

export function serializePgRow(row: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    o[k] = serializeCell(v);
  }
  return o;
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

function resolveViewColumnFromCandidates(
  catalog: BiSchemaCatalog,
  tableName: string,
  candidates: readonly string[],
): string | null {
  for (const c of candidates) {
    const n = resolveColumnName(catalog, tableName, c);
    if (n && isSafeIdent(n.toLowerCase())) return n;
  }
  return null;
}

function baseExistsBlockKey(viewKey: BiComissoesViewKey): keyof typeof BI_COMISSOES_CONFIG.baseExists | null {
  if (viewKey === "kpis") return "kpis";
  if (viewKey === "ranking") return "ranking";
  if (viewKey === "table") return "tabela";
  if (viewKey === "drill") return "drill";
  return null;
}

type WhereBuild = { fragment: string; values: unknown[]; periodApplied: boolean };

const BASE_INTROSPECT_NAME = "vw_comissoes_base";

/** Restringe `vendedor_final` à allowlist do módulo (mesma lógica em `EXISTS` e na base). */
function appendVendedorAllowlistPredicate(
  catalog: BiSchemaCatalog,
  values: unknown[],
  out: string[],
  tableKey: string,
  alias: string,
  withLeadingAnd: boolean,
): void {
  const allow = getBiComissoesVendedorAllowlistUpper();
  if (!allow?.length) return;
  const logical = BI_COMISSOES_CONFIG.filters.vendedor;
  if (!columnExists(catalog, tableKey, logical)) return;
  const col = resolveColumnName(catalog, tableKey, logical);
  if (!col) return;
  values.push(allow);
  const pred = `UPPER(BTRIM(${alias}.${col}::text)) = ANY($${values.length}::text[])`;
  out.push(withLeadingAnd ? `AND ${pred}` : pred);
}

function appendBasePeriodAndDimsFromMap(
  catalog: BiSchemaCatalog,
  dimMap: Map<string, string[]>,
  values: unknown[],
  inner: string[],
  appliedInExists: Set<string>,
  fromOk: boolean,
  toOk: boolean,
  from: string | null,
  to: string | null,
  includePeriod: boolean,
): boolean {
  let periodApplied = false;
  const dateResolved = resolveColumnName(catalog, "vw_comissoes_base", DATE_COL);
  if (!dateResolved) {
    throw new Error(`BI: a view bi.vw_comissoes_base precisa expor a coluna ${DATE_COL} para filtro de período.`);
  }
  if (includePeriod && fromOk) {
    values.push(from);
    inner.push(`b.${dateResolved}::date >= $${values.length}::date`);
    periodApplied = true;
  }
  if (includePeriod && toOk) {
    values.push(to);
    inner.push(`b.${dateResolved}::date <= $${values.length}::date`);
    periodApplied = true;
  }

  for (const [nk, vals] of dimMap) {
    if (!BI_COMISSOES_BASE_FILTER_COLUMNS.has(nk)) continue;
    if (!columnExists(catalog, "vw_comissoes_base", nk)) continue;
    if (appliedInExists.has(nk)) continue;
    appliedInExists.add(nk);
    const bcol = resolveColumnName(catalog, "vw_comissoes_base", nk)!;
    if (nk.startsWith("id_") && vals.every((v) => /^\d+$/.test(String(v).trim()))) {
      const nums = vals.map((v) => Number(String(v).trim()));
      if (nums.length === 1) {
        values.push(nums[0]);
        inner.push(`b.${bcol} = $${values.length}::numeric`);
      } else {
        values.push(nums);
        inner.push(`b.${bcol} = ANY($${values.length}::numeric[])`);
      }
    } else {
      pushTextEqOrAnyInner(inner, values, `b.${bcol}`, vals);
    }
  }
  appendVendedorAllowlistPredicate(catalog, values, inner, BASE_INTROSPECT_NAME, "b", false);
  return periodApplied;
}

function buildComissoesWhere(
  url: URL,
  catalog: BiSchemaCatalog,
  viewKey: BiComissoesViewKey,
  targetTable: string,
  includePeriod: boolean,
): WhereBuild {
  const values: unknown[] = [];
  const parts: string[] = [];
  let periodApplied = false;
  const dimMap = collectBaseDimensionFilters(url);
  const appliedInExists = new Set<string>();

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromOk = Boolean(from && /^\d{4}-\d{2}-\d{2}$/.test(from));
  const toOk = Boolean(to && /^\d{4}-\d{2}-\d{2}$/.test(to));

  const baseView = BI_COMISSOES_CONFIG.views.base;

  if (viewKey === "base") {
    const dMain = resolveColumnName(catalog, targetTable, DATE_COL);
    if (!dMain) {
      throw new Error(`BI: a view ${baseView} precisa expor a coluna ${DATE_COL}.`);
    }
    if (includePeriod && fromOk) {
      values.push(from);
      parts.push(`AND ${MAIN_ALIAS}.${dMain}::date >= $${values.length}::date`);
      periodApplied = true;
    }
    if (includePeriod && toOk) {
      values.push(to);
      parts.push(`AND ${MAIN_ALIAS}.${dMain}::date <= $${values.length}::date`);
      periodApplied = true;
    }
    for (const [nk, vals] of dimMap) {
      if (!BI_COMISSOES_BASE_FILTER_COLUMNS.has(nk)) continue;
      if (!columnExists(catalog, targetTable, nk)) continue;
      const tcol = resolveColumnName(catalog, targetTable, nk)!;
      if (nk.startsWith("id_") && vals.every((v) => /^\d+$/.test(String(v).trim()))) {
        const nums = vals.map((v) => Number(String(v).trim()));
        if (nums.length === 1) {
          values.push(nums[0]);
          parts.push(`AND ${MAIN_ALIAS}.${tcol} = $${values.length}::numeric`);
        } else {
          values.push(nums);
          parts.push(`AND ${MAIN_ALIAS}.${tcol} = ANY($${values.length}::numeric[])`);
        }
      } else {
        pushTextEqOrAnyAnd(parts, values, `${MAIN_ALIAS}.${tcol}`, vals);
      }
      appliedInExists.add(nk);
    }
    appendVendedorAllowlistPredicate(catalog, values, parts, targetTable, MAIN_ALIAS, true);
  } else if (viewKey !== "filters") {
    const blockKey = baseExistsBlockKey(viewKey);
    if (!blockKey) {
      throw new Error(`BI: viewKey '${viewKey}' sem bloco baseExists configurado.`);
    }
    const strat = BI_COMISSOES_CONFIG.baseExists[blockKey];

    if (strat.mode === "uncorrelated") {
      const inner: string[] = [];
      const p = appendBasePeriodAndDimsFromMap(
        catalog,
        dimMap,
        values,
        inner,
        appliedInExists,
        fromOk,
        toOk,
        from,
        to,
        includePeriod,
      );
      periodApplied = p;
      if (inner.length) {
        parts.push(`AND EXISTS (SELECT 1 FROM ${baseView} b WHERE ${inner.join(" AND ")})`);
      }
    } else {
      const inner: string[] = [];
      for (const pair of strat.pairs) {
        const bcol = resolveColumnName(catalog, "vw_comissoes_base", pair.baseCol);
        const vcol = resolveViewColumnFromCandidates(catalog, targetTable, pair.viewCandidates);
        if (!bcol || !vcol) {
          throw new Error(
            `BI: correlação base↔view falhou para ${viewKey}: base.${pair.baseCol} com candidatos [${pair.viewCandidates.join(", ")}] na view alvo.`,
          );
        }
        inner.push(`b.${bcol} = ${MAIN_ALIAS}.${vcol}`);
      }
      const p = appendBasePeriodAndDimsFromMap(
        catalog,
        dimMap,
        values,
        inner,
        appliedInExists,
        fromOk,
        toOk,
        from,
        to,
        includePeriod,
      );
      periodApplied = p;
      if (inner.length) {
        parts.push(`AND EXISTS (SELECT 1 FROM ${baseView} b WHERE ${inner.join(" AND ")})`);
      }
    }
  }

  const seen = new Set<string>(appliedInExists);
  for (const [nk, vals] of dimMap) {
    if (seen.has(nk)) continue;
    if (!isSafeIdent(nk)) continue;
    if (viewKey !== "base" && BI_COMISSOES_BASE_FILTER_COLUMNS.has(nk) && columnExists(catalog, "vw_comissoes_base", nk)) {
      continue;
    }
    seen.add(nk);
    if (!columnExists(catalog, targetTable, nk)) continue;
    const tcol = resolveColumnName(catalog, targetTable, nk)!;
    if (nk.startsWith("id_") && vals.every((v) => /^\d+$/.test(String(v).trim()))) {
      const nums = vals.map((v) => Number(String(v).trim()));
      if (nums.length === 1) {
        values.push(nums[0]);
        parts.push(`AND ${MAIN_ALIAS}.${tcol} = $${values.length}::numeric`);
      } else {
        values.push(nums);
        parts.push(`AND ${MAIN_ALIAS}.${tcol} = ANY($${values.length}::numeric[])`);
      }
    } else {
      pushTextEqOrAnyAnd(parts, values, `${MAIN_ALIAS}.${tcol}`, vals);
    }
  }

  return { fragment: parts.join(" "), values, periodApplied };
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export type BiSelectQueryMeta = {
  periodApplied: boolean;
};

export async function selectBiView(
  pool: Pool,
  viewKey: BiComissoesViewKey,
  url: URL,
  opts?: {
    defaultLimit?: number;
    maxLimit?: number;
    hardLimit?: number;
    includePeriod?: boolean;
    forceSchemaRefresh?: boolean;
  },
): Promise<{ rows: Record<string, unknown>[]; view: string; meta: BiSelectQueryMeta }> {
  const viewFqn = BI_VIEWS[viewKey];
  const tableName = viewFqn.split(".")[1] || "";

  const allTables = [...new Set(Object.values(BI_VIEWS).map((fq) => fq.split(".")[1]!).filter(Boolean))];
  const schema = viewFqn.split(".")[0] || "bi";
  const catalog = await getBiComissoesSchemaCatalog(pool, schema, allTables, opts?.forceSchemaRefresh === true);

  if (catalog.missingTables.includes(tableName)) {
    throw new Error(
      `BI: a relação bi.${tableName} não foi encontrada no catálogo (information_schema). Verifique permissões e o nome do objeto.`,
    );
  }

  const includePeriod = opts?.includePeriod ?? viewKey !== "filters";

  const { fragment, values, periodApplied } = buildComissoesWhere(url, catalog, viewKey, tableName, includePeriod);

  const defaultLimit = opts?.defaultLimit ?? (viewKey === "kpis" || viewKey === "filters" ? 5000 : 500);
  const maxLimit = opts?.maxLimit ?? 2000;
  const hardLimit = opts?.hardLimit ?? 10000;

  const limRaw = Number(url.searchParams.get("limit") || defaultLimit);
  const offRaw = Number(url.searchParams.get("offset") || 0);
  const limit = clampInt(limRaw, 1, Math.min(maxLimit, hardLimit));
  const offset = clampInt(offRaw, 0, hardLimit);

  const limitIdx = values.length + 1;
  const offsetIdx = values.length + 2;
  const sql = `SELECT ${MAIN_ALIAS}.* FROM ${viewFqn} ${MAIN_ALIAS} WHERE 1=1 ${fragment} LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int`;
  const params = [...values, limit, offset];
  const result = await pool.query(sql, params);
  const rows = (result.rows || []).map((r) => serializePgRow(r as Record<string, unknown>));

  return { rows, view: viewFqn, meta: { periodApplied } };
}

const BASE_REL = "vw_comissoes_base";

/**
 * KPIs alinhados ao período e filtros: agrega `bi.vw_comissoes_base` (a view `vw_comissoes_kpis` do banco não filtra por data).
 */
export async function selectComissoesKpisFromBase(
  pool: Pool,
  url: URL,
  opts?: { forceSchemaRefresh?: boolean },
): Promise<{ rows: Record<string, unknown>[]; meta: BiSelectQueryMeta }> {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) {
    throw new Error(`BI: a relação bi.${BASE_REL} não foi encontrada no catálogo.`);
  }
  const { fragment, values, periodApplied } = buildComissoesWhere(url, catalog, "base", BASE_REL, true);
  const baseFqn = BI_COMISSOES_CONFIG.views.base;
  const sql = `
    WITH scoped AS (
      SELECT ${MAIN_ALIAS}.* FROM ${baseFqn} ${MAIN_ALIAS} WHERE 1=1 ${fragment}
    ),
    nf AS (
      SELECT COALESCE(SUM(m.vl), 0)::numeric AS faturado_nota
      FROM (
        SELECT s.id_unico_nf, MAX(s.valor_faturado) AS vl
        FROM scoped s
        WHERE s.id_unico_nf IS NOT NULL AND BTRIM(s.id_unico_nf::text) <> ''
        GROUP BY s.id_unico_nf
      ) m
    ),
    com AS (
      SELECT
        COALESCE(SUM(s.valor_comissao), 0)::numeric AS total_comissoes,
        COUNT(DISTINCT s.vendedor_final)::int AS qtd_vendedores
      FROM scoped s
      WHERE s.vendedor_final IS NOT NULL AND BTRIM(s.vendedor_final::text) <> ''
    )
    SELECT
      com.total_comissoes AS total_a_pagar,
      nf.faturado_nota AS vendas_totais_base,
      CASE
        WHEN nf.faturado_nota = 0::numeric THEN 0::numeric
        ELSE com.total_comissoes / NULLIF(nf.faturado_nota, 0::numeric)
      END AS custo_efetivo,
      com.qtd_vendedores AS qtd_vendedores_pagos
    FROM com CROSS JOIN nf
  `;
  const result = await pool.query(sql, values);
  const row = result.rows?.[0] as Record<string, unknown> | undefined;
  return { rows: row ? [serializePgRow(row)] : [serializePgRow({})], meta: { periodApplied } };
}

/**
 * Tabela “por vendedor” com colunas de tipo como na `vw_comissoes_tabela`, porém restrita ao mesmo período/filtros da base.
 */
export async function selectComissoesTabelaFromBase(
  pool: Pool,
  url: URL,
  opts?: {
    defaultLimit?: number;
    maxLimit?: number;
    hardLimit?: number;
    forceSchemaRefresh?: boolean;
  },
): Promise<{ rows: Record<string, unknown>[]; meta: BiSelectQueryMeta }> {
  const catalog = await getBiComissoesSchemaCatalog(pool, "bi", [BASE_REL], opts?.forceSchemaRefresh === true);
  if (catalog.missingTables.includes(BASE_REL)) {
    throw new Error(`BI: a relação bi.${BASE_REL} não foi encontrada no catálogo.`);
  }
  const { fragment, values, periodApplied } = buildComissoesWhere(url, catalog, "base", BASE_REL, true);
  const baseFqn = BI_COMISSOES_CONFIG.views.base;
  const defaultLimit = opts?.defaultLimit ?? 500;
  const maxLimit = opts?.maxLimit ?? 2000;
  const hardLimit = opts?.hardLimit ?? 10000;
  const limRaw = Number(url.searchParams.get("limit") || defaultLimit);
  const offRaw = Number(url.searchParams.get("offset") || 0);
  const limit = clampInt(limRaw, 1, Math.min(maxLimit, hardLimit));
  const offset = clampInt(offRaw, 0, hardLimit);
  const limitIdx = values.length + 1;
  const offsetIdx = values.length + 2;
  const sql = `
    WITH scoped AS (
      SELECT ${MAIN_ALIAS}.* FROM ${baseFqn} ${MAIN_ALIAS} WHERE 1=1 ${fragment}
    )
    SELECT
      scoped.vendedor_final AS vendedor,
      COALESCE(SUM(CASE WHEN scoped.tipo_comissao = 'NEGOCIADOR'::text THEN scoped.valor_comissao ELSE 0::numeric END), 0::numeric) AS negociador,
      COALESCE(SUM(CASE WHEN scoped.tipo_comissao = 'REDESPACHO'::text THEN scoped.valor_comissao ELSE 0::numeric END), 0::numeric) AS redespacho,
      COALESCE(SUM(CASE WHEN scoped.tipo_comissao = 'SUPERVISAO'::text THEN scoped.valor_comissao ELSE 0::numeric END), 0::numeric) AS supervisao,
      COALESCE(SUM(CASE WHEN scoped.tipo_comissao = 'TABELA INTEGRAL'::text THEN scoped.valor_comissao ELSE 0::numeric END), 0::numeric) AS tabela_integral,
      COALESCE(SUM(CASE WHEN scoped.tipo_comissao = 'TABELA RATEIO'::text THEN scoped.valor_comissao ELSE 0::numeric END), 0::numeric) AS tabela_rateio,
      COALESCE(SUM(scoped.valor_comissao), 0::numeric) AS total
    FROM scoped scoped
    WHERE scoped.vendedor_final IS NOT NULL AND BTRIM(scoped.vendedor_final::text) <> ''
    GROUP BY scoped.vendedor_final
    ORDER BY scoped.vendedor_final
    LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int
  `;
  const result = await pool.query(sql, [...values, limit, offset]);
  const rows = (result.rows || []).map((r) => serializePgRow(r as Record<string, unknown>));
  return { rows, meta: { periodApplied } };
}
