import type { Pool } from "pg";

export type TesourariaFilters = {
  from: string;
  to: string;
  grupoFluxo: string[];
  contaOrigem: string[];
  contaDestino: string[];
  q: string;
};

export type TesourariaTableQuery = TesourariaFilters & {
  sortColumn: string;
  sortDir: "asc" | "desc";
  limit: number;
  offset: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

function defaultPeriod(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 12);
  return { from: toYmd(from), to: toYmd(to) };
}

function parseMulti(sp: URLSearchParams, key: string): string[] {
  const all = [...sp.getAll(key), ...(sp.get(key)?.includes(",") ? sp.get(key)!.split(",") : [])]
    .flatMap((v) => String(v || "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(all)];
}

export function parseTesourariaFiltersFromUrl(url: URL): TesourariaFilters {
  const sp = url.searchParams;
  const def = defaultPeriod();
  let from = String(sp.get("from") || "").trim();
  let to = String(sp.get("to") || "").trim();
  if (!to || !parseYmd(to)) to = def.to;
  if (!from || !parseYmd(from)) from = def.from;
  const df = parseYmd(from);
  const dt = parseYmd(to);
  if (df && dt && df.getTime() > dt.getTime()) {
    from = def.from;
    to = def.to;
  }
  return {
    from,
    to,
    grupoFluxo: parseMulti(sp, "grupoFluxo"),
    contaOrigem: parseMulti(sp, "contaOrigem"),
    contaDestino: parseMulti(sp, "contaDestino"),
    q: String(sp.get("q") || "").trim(),
  };
}

const SORT_SQL: Record<string, string> = {
  data: "t.data",
  data_conciliacao: "t.data_conciliacao",
  vencimento: "t.vencimento",
  valor_transferencia: "t.valor_transferencia",
  id_transferencia: "t.id_transferencia",
  numero_documento: "t.numero_documento",
  historico: "t.historico",
  grupo_fluxo: "t.grupo_fluxo",
};

export function parseTesourariaTableFromUrl(url: URL): TesourariaTableQuery {
  const base = parseTesourariaFiltersFromUrl(url);
  const sp = url.searchParams;
  const sc = String(sp.get("sort") || "data").trim().toLowerCase();
  const sortColumn = SORT_SQL[sc] ? sc : "data";
  const sd = String(sp.get("dir") || "desc").trim().toLowerCase();
  const sortDir: "asc" | "desc" = sd === "asc" ? "asc" : "desc";
  let limit = parseInt(String(sp.get("limit") || "50"), 10) || 50;
  if (limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  let offset = parseInt(String(sp.get("offset") || "0"), 10) || 0;
  if (offset < 0) offset = 0;
  return { ...base, sortColumn, sortDir, limit, offset };
}

type WhereBuild = { whereSql: string; params: unknown[] };

/** Filtros sobre `bi.vw_tesouraria_transferencias` (alias `t`). */
export function buildTesourariaWhere(f: TesourariaFilters): WhereBuild {
  const params: unknown[] = [];
  let i = 1;
  const parts: string[] = [];
  parts.push(`DATE(t.data) BETWEEN $${i++}::date AND $${i++}::date`);
  params.push(f.from, f.to);
  if (f.grupoFluxo.length > 0) {
    parts.push(`COALESCE(NULLIF(TRIM(t.grupo_fluxo::text), ''), 'outros') = ANY($${i++}::text[])`);
    params.push(f.grupoFluxo);
  }
  if (f.contaOrigem.length > 0) {
    parts.push(
      `(COALESCE(NULLIF(TRIM(t.conta_convenio_origem), ''), NULLIF(TRIM(t.conta_origem), ''), 'SEM_CONTA_ORIGEM')) = ANY($${i++}::text[])`,
    );
    params.push(f.contaOrigem);
  }
  if (f.contaDestino.length > 0) {
    parts.push(
      `(COALESCE(NULLIF(TRIM(t.conta_convenio_destino), ''), NULLIF(TRIM(t.conta_destino), ''), 'SEM_CONTA_DESTINO')) = ANY($${i++}::text[])`,
    );
    params.push(f.contaDestino);
  }
  if (f.q.trim()) {
    const safe = `%${f.q.replace(/%/g, "").replace(/_/g, "")}%`;
    parts.push(
      `(t.historico ILIKE $${i} OR t.historico_limpo ILIKE $${i} OR COALESCE(t.numero_documento::text, '') ILIKE $${i} OR CAST(t.id_transferencia AS text) ILIKE $${i})`,
    );
    params.push(safe);
    i += 1;
  }
  return { whereSql: parts.join(" AND "), params };
}

export async function selectTesourariaKpis(pool: Pool, f: TesourariaFilters) {
  const w = buildTesourariaWhere(f);
  const sql = `
    SELECT
      round(coalesce(sum(t.valor_transferencia), 0)::numeric, 2)::float8 AS total_transferido,
      round(coalesce(sum(CASE WHEN t.grupo_fluxo = 'tesouraria' THEN t.valor_transferencia ELSE 0 END), 0)::numeric, 2)::float8 AS total_tesouraria,
      round(coalesce(sum(CASE WHEN t.grupo_fluxo = 'suprimento_caixa' THEN t.valor_transferencia ELSE 0 END), 0)::numeric, 2)::float8 AS total_suprimento,
      round(coalesce(sum(CASE WHEN t.foi_conciliado IS TRUE THEN t.valor_transferencia ELSE 0 END), 0)::numeric, 2)::float8 AS total_conciliado,
      count(*)::bigint AS qtd_transferencias
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
  `;
  const r = await pool.query(sql, w.params);
  return (r.rows?.[0] || {}) as Record<string, unknown>;
}

export async function selectTesourariaResumoMensal(pool: Pool, f: TesourariaFilters) {
  const w = buildTesourariaWhere(f);
  const sql = `
    SELECT
      date_trunc('month', t.data)::date AS mes_referencia,
      round(sum(t.valor_transferencia)::numeric, 2)::float8 AS total_transferido,
      round(sum(CASE WHEN t.grupo_fluxo = 'tesouraria' THEN t.valor_transferencia ELSE 0 END)::numeric, 2)::float8 AS total_tesouraria,
      round(sum(CASE WHEN t.grupo_fluxo = 'suprimento_caixa' THEN t.valor_transferencia ELSE 0 END)::numeric, 2)::float8 AS total_suprimento,
      round(sum(CASE WHEN t.foi_conciliado IS TRUE THEN t.valor_transferencia ELSE 0 END)::numeric, 2)::float8 AS total_conciliado,
      count(*)::bigint AS qtd_transferencias
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const r = await pool.query(sql, w.params);
  return r.rows || [];
}

export async function selectTesourariaPorOrigem(pool: Pool, f: TesourariaFilters, topN = 15) {
  const w = buildTesourariaWhere(f);
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(t.conta_origem), ''), 'SEM_CONTA_ORIGEM') AS conta_origem,
      COALESCE(NULLIF(TRIM(t.nome_banco_origem), ''), 'SEM_BANCO_ORIGEM') AS banco_origem,
      round(sum(t.valor_transferencia)::numeric, 2)::float8 AS valor_total,
      count(*)::bigint AS qtd_transferencias
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST
    LIMIT $${w.params.length + 1}
  `;
  const r = await pool.query(sql, [...w.params, topN]);
  return r.rows || [];
}

export async function selectTesourariaPorDestino(pool: Pool, f: TesourariaFilters, topN = 15) {
  const w = buildTesourariaWhere(f);
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(t.conta_destino), ''), 'SEM_CONTA_DESTINO') AS conta_destino,
      COALESCE(NULLIF(TRIM(t.nome_banco_destino), ''), 'SEM_BANCO_DESTINO') AS banco_destino,
      round(sum(t.valor_transferencia)::numeric, 2)::float8 AS valor_total,
      count(*)::bigint AS qtd_transferencias
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST
    LIMIT $${w.params.length + 1}
  `;
  const r = await pool.query(sql, [...w.params, topN]);
  return r.rows || [];
}

export async function selectTesourariaPorGrupoFluxo(pool: Pool, f: TesourariaFilters) {
  const w = buildTesourariaWhere(f);
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(t.grupo_fluxo::text), ''), 'outros') AS grupo_fluxo,
      round(sum(t.valor_transferencia)::numeric, 2)::float8 AS valor_total,
      count(*)::bigint AS qtd_transferencias
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
    GROUP BY 1
    ORDER BY 2 DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.params);
  return r.rows || [];
}

export async function selectTesourariaTransferenciasTable(pool: Pool, q: TesourariaTableQuery) {
  const w = buildTesourariaWhere(q);
  const sortCol = SORT_SQL[q.sortColumn] ? q.sortColumn : "data";
  const orderExpr = SORT_SQL[sortCol];
  const dir = q.sortDir === "asc" ? "ASC" : "DESC";
  const countSql = `
    SELECT count(*)::bigint AS c
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
  `;
  const dataSql = `
    SELECT
      t.id_transferencia,
      t.data,
      t.data_conciliacao,
      t.vencimento,
      t.banco_origem,
      t.nome_banco_origem,
      t.conta_origem,
      t.banco_destino,
      t.nome_banco_destino,
      t.conta_destino,
      t.valor_transferencia::float8,
      t.numero_documento,
      t.historico,
      t.grupo_fluxo,
      t.foi_conciliado,
      t.id_convenio_orig,
      t.id_convenio_dest,
      t.tipo,
      t.tipo_transferencia,
      t.tipo_lcto
    FROM bi.vw_tesouraria_transferencias t
    WHERE ${w.whereSql}
    ORDER BY ${orderExpr} ${dir} NULLS LAST, t.id_transferencia DESC
    LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}
  `;
  const [cRes, dRes] = await Promise.all([
    pool.query(countSql, w.params),
    pool.query(dataSql, [...w.params, q.limit, q.offset]),
  ]);
  const total = Number(cRes.rows?.[0]?.c ?? 0) || 0;
  return { rows: dRes.rows || [], total };
}

export async function selectTesourariaFacetOptions(pool: Pool) {
  const lim = "t.data >= (CURRENT_DATE - INTERVAL '36 months')";
  const [grupos, origens, destinos] = await Promise.all([
    pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(t.grupo_fluxo::text), ''), 'outros') AS v
       FROM bi.vw_tesouraria_transferencias t
       WHERE ${lim} AND t.data IS NOT NULL
       ORDER BY 1 NULLS LAST
       LIMIT 200`,
    ),
    pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(t.conta_convenio_origem), ''), NULLIF(TRIM(t.conta_origem), ''), 'SEM_CONTA_ORIGEM') AS v
       FROM bi.vw_tesouraria_transferencias t
       WHERE ${lim} AND t.data IS NOT NULL
       ORDER BY 1 NULLS LAST
       LIMIT 500`,
    ),
    pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(t.conta_convenio_destino), ''), NULLIF(TRIM(t.conta_destino), ''), 'SEM_CONTA_DESTINO') AS v
       FROM bi.vw_tesouraria_transferencias t
       WHERE ${lim} AND t.data IS NOT NULL
       ORDER BY 1 NULLS LAST
       LIMIT 500`,
    ),
  ]);
  return {
    gruposFluxo: (grupos.rows || []).map((r: { v: unknown }) => String(r.v ?? "")).filter(Boolean),
    contasOrigem: (origens.rows || []).map((r: { v: unknown }) => String(r.v ?? "")).filter(Boolean),
    contasDestino: (destinos.rows || []).map((r: { v: unknown }) => String(r.v ?? "")).filter(Boolean),
  };
}
