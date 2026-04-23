import type { Pool } from "pg";

/** Filtros comuns às consultas do BI Financeiro (obrigações / resumos). */
export type FinanceiroFilters = {
  from: string;
  to: string;
  centroCusto: string[];
  tipoParte: string[];
  idEstabelecimento: string[];
  q: string;
};

export type FinanceiroTableQuery = FinanceiroFilters & {
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

export function parseFinanceiroFiltersFromUrl(url: URL): FinanceiroFilters {
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
    centroCusto: parseMulti(sp, "centroCusto"),
    tipoParte: parseMulti(sp, "tipoParte"),
    idEstabelecimento: parseMulti(sp, "idEstabelecimento"),
    q: String(sp.get("q") || "").trim(),
  };
}

const SORT_SQL: Record<string, string> = {
  data_lcto: "o.data_lcto",
  data_emissao: "o.data_emissao",
  vencimento: "o.vencimento",
  data_liquidacao: "o.data_liquidacao",
  valor_principal: "o.valor_principal",
  valor_total_calculado: "o.valor_total_calculado",
  valor_liquidado: "o.valor_liquidado",
  id_obrigacao: "o.id_obrigacao",
  documento: "o.documento",
  historico: "o.historico",
  tipo_parte: "o.tipo_parte",
  centro_custo_codigo: "o.centro_custo_codigo",
};

export function parseFinanceiroTableFromUrl(url: URL): FinanceiroTableQuery {
  const base = parseFinanceiroFiltersFromUrl(url);
  const sp = url.searchParams;
  const sc = String(sp.get("sort") || "data_lcto").trim().toLowerCase();
  const sortColumn = SORT_SQL[sc] ? sc : "data_lcto";
  const sd = String(sp.get("dir") || "desc").trim().toLowerCase();
  const sortDir: "asc" | "desc" = sd === "asc" ? "asc" : "desc";
  let limit = parseInt(String(sp.get("limit") || "50"), 10) || 50;
  if (limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  let offset = parseInt(String(sp.get("offset") || "0"), 10) || 0;
  if (offset < 0) offset = 0;
  return { ...base, sortColumn, sortDir, limit, offset };
}

/** Período anterior com mesma duração (dias inclusivos), para comparação simples nos cards. */
export function previousInclusiveRange(from: string, to: string): { prevFrom: string; prevTo: string } {
  const df = parseYmd(from);
  const dt = parseYmd(to);
  if (!df || !dt) {
    const d = defaultPeriod();
    return previousInclusiveRange(d.from, d.to);
  }
  const dayMs = 86400000;
  const days = Math.max(1, Math.round((dt.getTime() - df.getTime()) / dayMs) + 1);
  const prevTo = new Date(df.getTime() - dayMs);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * dayMs);
  return { prevFrom: toYmd(prevFrom), prevTo: toYmd(prevTo) };
}

type WhereBuild = { whereSql: string; params: unknown[] };

function buildObrigacoesWhere(f: FinanceiroFilters): WhereBuild {
  const params: unknown[] = [];
  let i = 1;
  const parts: string[] = [];
  parts.push(
    `DATE(COALESCE(o.vencimento, o.data_lcto, o.data_emissao)) BETWEEN $${i++}::date AND $${i++}::date`,
  );
  params.push(f.from, f.to);
  if (f.centroCusto.length > 0) {
    parts.push(`o.centro_custo_codigo = ANY($${i++}::text[])`);
    params.push(f.centroCusto);
  }
  if (f.tipoParte.length > 0) {
    parts.push(`TRIM(COALESCE(o.tipo_parte::text, '')) = ANY($${i++}::text[])`);
    params.push(f.tipoParte);
  }
  if (f.idEstabelecimento.length > 0) {
    const nums = f.idEstabelecimento.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    if (nums.length > 0) {
      parts.push(`o.id_estabelecimento = ANY($${i++}::bigint[])`);
      params.push(nums);
    }
  }
  if (f.q) {
    const safe = `%${f.q.replace(/%/g, "").replace(/_/g, "")}%`;
    parts.push(
      `(o.historico ILIKE $${i} OR o.documento ILIKE $${i} OR CAST(o.id_obrigacao AS text) ILIKE $${i})`,
    );
    params.push(safe);
    i += 1;
  }
  return { whereSql: parts.join(" AND "), params };
}

export async function selectFinanceiroResumoMensal(pool: Pool, f: FinanceiroFilters) {
  const w = buildObrigacoesWhere(f);
  const sql = `
    SELECT
      date_trunc('month', x.data_ref)::date AS mes_referencia,
      round(sum(x.valor_em_aberto)::numeric, 2) AS total_em_aberto,
      round(sum(x.valor_liquidado_calc)::numeric, 2) AS total_liquidado,
      round(sum(x.valor_vencido)::numeric, 2) AS total_vencido,
      count(*)::bigint AS qtd_registros
    FROM (
      SELECT
        DATE(COALESCE(o.vencimento, o.data_lcto, o.data_emissao)) AS data_ref,
        CASE
          WHEN o.foi_liquidado IS TRUE THEN 0::double precision
          ELSE COALESCE(o.valor_total_calculado, 0::double precision)
        END AS valor_em_aberto,
        COALESCE(o.valor_liquidado, 0::double precision) AS valor_liquidado_calc,
        CASE
          WHEN o.esta_vencido IS TRUE THEN COALESCE(o.valor_total_calculado, 0::double precision)
          ELSE 0::double precision
        END AS valor_vencido
      FROM bi.vw_fin_obrigacoes_validas o
      WHERE ${w.whereSql}
    ) x
    WHERE x.data_ref IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const r = await pool.query(sql, w.params);
  return r.rows || [];
}

export async function selectFinanceiroCentroCusto(pool: Pool, f: FinanceiroFilters) {
  const w = buildObrigacoesWhere(f);
  const sql = `
    SELECT
      COALESCE(o.centro_custo_codigo, 'SEM_CENTRO') AS centro_custo_codigo,
      COALESCE(o.centro_custo_descricao, 'SEM_CENTRO') AS centro_custo_descricao,
      sum(COALESCE(o.valor_total_calculado, 0::double precision))::float8 AS valor_total,
      sum(COALESCE(o.valor_liquidado, 0::double precision))::float8 AS valor_liquidado,
      sum(
        CASE WHEN o.foi_liquidado IS TRUE THEN 0::double precision
        ELSE COALESCE(o.valor_total_calculado, 0::double precision) END
      )::float8 AS valor_em_aberto,
      sum(
        CASE WHEN o.esta_vencido IS TRUE THEN COALESCE(o.valor_total_calculado, 0::double precision)
        ELSE 0::double precision END
      )::float8 AS valor_vencido,
      count(*)::bigint AS qtd_titulos
    FROM bi.vw_fin_obrigacoes_validas o
    WHERE ${w.whereSql}
    GROUP BY 1, 2
    ORDER BY sum(COALESCE(o.valor_total_calculado, 0::double precision)) DESC
    LIMIT 40
  `;
  const r = await pool.query(sql, w.params);
  return r.rows || [];
}

export async function selectFinanceiroKpisObrigacoes(pool: Pool, f: FinanceiroFilters) {
  const w = buildObrigacoesWhere(f);
  const sql = `
    SELECT
      coalesce(sum(
        CASE WHEN o.foi_liquidado IS TRUE THEN 0::double precision
        ELSE COALESCE(o.valor_total_calculado, 0::double precision) END
      ), 0)::float8 AS total_em_aberto,
      coalesce(sum(COALESCE(o.valor_liquidado, 0::double precision)), 0)::float8 AS total_liquidado,
      coalesce(sum(
        CASE WHEN o.esta_vencido IS TRUE THEN COALESCE(o.valor_total_calculado, 0::double precision)
        ELSE 0::double precision END
      ), 0)::float8 AS total_vencido
    FROM bi.vw_fin_obrigacoes_validas o
    WHERE ${w.whereSql}
  `;
  const r = await pool.query(sql, w.params);
  return (r.rows?.[0] || {}) as Record<string, unknown>;
}

export async function selectFinanceiroFaturamentoMensal(pool: Pool, from: string, to: string) {
  const sql = `
    SELECT
      mes_referencia,
      valor_fatura::float8,
      valor_desconto::float8,
      valor_acrescimo::float8,
      valor_final::float8,
      qtd_faturas::bigint
    FROM bi.vw_fin_faturamento_mensal
    WHERE mes_referencia >= date_trunc('month', $1::date)::date
      AND mes_referencia <= date_trunc('month', $2::date)::date
    ORDER BY mes_referencia ASC
  `;
  const r = await pool.query(sql, [from, to]);
  return r.rows || [];
}

export async function selectFinanceiroFaturadoTotal(pool: Pool, from: string, to: string) {
  const sql = `
    SELECT coalesce(sum(valor_final), 0)::float8 AS total_faturado
    FROM bi.vw_fin_faturamento_mensal
    WHERE mes_referencia >= date_trunc('month', $1::date)::date
      AND mes_referencia <= date_trunc('month', $2::date)::date
  `;
  const r = await pool.query(sql, [from, to]);
  const v = r.rows?.[0]?.total_faturado;
  return typeof v === "number" ? v : Number(v) || 0;
}

export async function selectFinanceiroObrigacoesTable(pool: Pool, q: FinanceiroTableQuery) {
  const w = buildObrigacoesWhere(q);
  const sortCol = SORT_SQL[q.sortColumn] ? q.sortColumn : "data_lcto";
  const orderExpr = SORT_SQL[sortCol];
  const dir = q.sortDir === "asc" ? "ASC" : "DESC";
  const countSql = `
    SELECT count(*)::bigint AS c
    FROM bi.vw_fin_obrigacoes_validas o
    WHERE ${w.whereSql}
  `;
  const dataSql = `
    SELECT
      o.id_obrigacao,
      o.data_lcto,
      o.data_emissao,
      o.vencimento,
      o.data_liquidacao,
      o.tipo_parte,
      o.centro_custo_codigo,
      o.centro_custo_descricao,
      o.historico,
      o.documento,
      o.valor_principal::float8,
      o.valor_total_calculado::float8,
      o.valor_liquidado::float8,
      o.foi_liquidado,
      o.esta_vencido,
      o.status_financeiro,
      o.id_estabelecimento,
      o.id_convenio
    FROM bi.vw_fin_obrigacoes_validas o
    WHERE ${w.whereSql}
    ORDER BY ${orderExpr} ${dir} NULLS LAST
    LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}
  `;
  const [cRes, dRes] = await Promise.all([
    pool.query(countSql, w.params),
    pool.query(dataSql, [...w.params, q.limit, q.offset]),
  ]);
  const total = Number(cRes.rows?.[0]?.c ?? 0) || 0;
  return { rows: dRes.rows || [], total };
}

export async function selectFinanceiroFacetOptions(pool: Pool) {
  const lim = "DATE(COALESCE(vencimento, data_lcto, data_emissao)) >= (CURRENT_DATE - INTERVAL '36 months')";
  const [centros, tipos, estabs] = await Promise.all([
    pool.query(
      `SELECT DISTINCT centro_custo_codigo AS v, centro_custo_descricao AS d
       FROM bi.vw_fin_obrigacoes_validas WHERE ${lim} AND centro_custo_codigo IS NOT NULL
       ORDER BY 1 NULLS LAST LIMIT 500`,
    ),
    pool.query(
      `SELECT DISTINCT TRIM(COALESCE(tipo_parte::text, '')) AS v
       FROM bi.vw_fin_obrigacoes_validas WHERE ${lim} AND TRIM(COALESCE(tipo_parte::text, '')) <> ''
       ORDER BY 1 LIMIT 200`,
    ),
    pool.query(
      `SELECT DISTINCT id_estabelecimento AS v
       FROM bi.vw_fin_obrigacoes_validas WHERE ${lim} AND id_estabelecimento IS NOT NULL
       ORDER BY 1 LIMIT 200`,
    ),
  ]);
  return {
    centros: (centros.rows || []).map((r: any) => ({
      codigo: r.v != null ? String(r.v) : "",
      descricao: r.d != null ? String(r.d) : "",
    })),
    tiposParte: (tipos.rows || []).map((r: any) => String(r.v || "")).filter(Boolean),
    estabelecimentos: (estabs.rows || []).map((r: any) => String(r.v ?? "")).filter(Boolean),
  };
}
