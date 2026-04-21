/**
 * BI Carteira / Tabelas combinadas — leituras agregadas sobre `bi.vw_tabelas_combinadas_base`
 * com os mesmos filtros em todas as consultas (periodo + vendedor + status + cliente).
 */
import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { BI_TABELAS_COMBINADAS_CONFIG } from "@/modules/bi/tabelasCombinadas/config";

const RESERVED = new Set(["from", "to", "limit", "offset", "refresh", "search"]);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolveTcPeriod(url: URL): { from: string; to: string } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
  return {
    from: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    to: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

function collectMulti(url: URL, paramKey: string): string[] {
  const k = paramKey.toLowerCase();
  const out: string[] = [];
  for (const [key, val] of url.searchParams.entries()) {
    if (key.toLowerCase() !== k) continue;
    const t = val.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export type TcWhere = { sql: string; values: unknown[] };

/** Predicados sobre alias `b` (base). */
export function buildTcBaseWhere(url: URL): TcWhere {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolveTcPeriod(url);
  values.push(from, to);
  parts.push(`b.data_referencia >= $1::date AND b.data_referencia <= $2::date`);

  const F = BI_TABELAS_COMBINADAS_CONFIG.filters;
  const vend = collectMulti(url, F.vendedor).map((v) => v.trim()).filter(Boolean);
  if (vend.length) {
    const up = vend.map((v) => v.toUpperCase());
    if (up.length === 1) {
      values.push(up[0]);
      parts.push(`upper(trim(b.vendedor::text)) = $${values.length}::text`);
    } else {
      values.push(up);
      parts.push(`upper(trim(b.vendedor::text)) = ANY($${values.length}::text[])`);
    }
  }

  const sts = collectMulti(url, F.statusAtual).map((v) => v.trim()).filter(Boolean);
  if (sts.length) {
    if (sts.length === 1) {
      values.push(sts[0]);
      parts.push(`b.status_atual = $${values.length}::text`);
    } else {
      values.push(sts);
      parts.push(`b.status_atual = ANY($${values.length}::text[])`);
    }
  }

  const cli = collectMulti(url, F.cliente).map((v) => v.trim()).filter(Boolean);
  if (cli.length) {
    if (cli.length === 1) {
      values.push(cli[0]);
      parts.push(`b.cliente = $${values.length}::text`);
    } else {
      values.push(cli);
      parts.push(`b.cliente = ANY($${values.length}::text[])`);
    }
  }

  const search = url.searchParams.get("search")?.trim();
  if (search && search.length >= 2) {
    const safe = `%${search.replace(/[%_\\]/g, "").slice(0, 120)}%`;
    if (safe.length > 2) {
      values.push(safe);
      parts.push(`(b.cliente ILIKE $${values.length}::text OR b.tabela_nome ILIKE $${values.length}::text)`);
    }
  }

  return { sql: parts.join(" AND "), values };
}

export async function selectTcKpis(pool: Pool, url: URL): Promise<Record<string, unknown>> {
  const w = buildTcBaseWhere(url);
  const sql = `
    SELECT
      count(*)::bigint AS contratos_monitorados,
      sum(b.contrato_critico_flag)::bigint AS contratos_criticos,
      sum(b.contrato_recuperar_flag)::bigint AS contratos_recuperar,
      coalesce(sum(b.oportunidade_recuperacao_valor), 0)::numeric(15,2) AS mina_de_ouro_winback,
      CASE WHEN count(*) = 0 THEN 0::numeric
           ELSE sum(b.carteira_saudavel_flag)::numeric / count(*)::numeric END AS carteira_saudavel_percentual,
      coalesce(sum(b.risco_silencioso_valor), 0)::numeric(15,2) AS risco_silencioso_valor,
      sum(b.sem_dono_flag)::bigint AS contratos_sem_dono,
      coalesce(avg(b.media_ticket), 0)::numeric(15,2) AS ticket_medio_carteira
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
  `;
  const r = await pool.query(sql, w.values);
  const row = r.rows?.[0] ?? {};
  return serializePgRow(row as Record<string, unknown>);
}

export async function selectTcFacetOptions(pool: Pool, url: URL): Promise<{
  vendedores: string[];
  status: string[];
  clientes: string[];
}> {
  const w = buildTcBaseWhere(url);
  const base = `FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b WHERE ${w.sql}`;

  const [vRes, sRes, cRes] = await Promise.all([
    pool.query(`SELECT DISTINCT trim(b.vendedor::text) AS v ${base} AND trim(b.vendedor::text) <> '' ORDER BY 1 LIMIT 400`, w.values),
    pool.query(`SELECT DISTINCT trim(b.status_atual::text) AS s ${base} AND b.status_atual IS NOT NULL ORDER BY 1 LIMIT 200`, w.values),
    pool.query(`SELECT DISTINCT trim(b.cliente::text) AS c ${base} AND trim(b.cliente::text) <> '' ORDER BY 1 LIMIT 500`, w.values),
  ]);

  const vendedores = (vRes.rows || []).map((x: { v: unknown }) => String(x.v ?? "").trim()).filter(Boolean);
  const status = (sRes.rows || []).map((x: { s: unknown }) => String(x.s ?? "").trim()).filter(Boolean);
  const clientes = (cRes.rows || []).map((x: { c: unknown }) => String(x.c ?? "").trim()).filter(Boolean);
  return { vendedores, status, clientes };
}

export type TcVendedorRiscoRow = {
  vendedor: string;
  risco_financeiro: number;
  risco_silencioso: number;
};

export async function selectTcVendedorRisco(pool: Pool, url: URL): Promise<TcVendedorRiscoRow[]> {
  const w = buildTcBaseWhere(url);
  const sql = `
    SELECT
      trim(b.vendedor::text) AS vendedor,
      coalesce(sum(b.risco_financeiro_valor), 0)::numeric(15,2) AS risco_financeiro,
      coalesce(sum(b.risco_silencioso_valor), 0)::numeric(15,2) AS risco_silencioso
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
      AND trim(coalesce(b.vendedor::text, '')) <> ''
    GROUP BY 1
    ORDER BY (coalesce(sum(b.risco_financeiro_valor), 0) + coalesce(sum(b.risco_silencioso_valor), 0)) DESC NULLS LAST
    LIMIT 40
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    vendedor: String(row.vendedor ?? ""),
    risco_financeiro: Number(row.risco_financeiro ?? 0),
    risco_silencioso: Number(row.risco_silencioso ?? 0),
  }));
}

export async function selectTcStatusDiagnostico(
  pool: Pool,
  url: URL,
): Promise<Array<{ status_grupo: string; valor: number; qtd_contratos: number }>> {
  const w = buildTcBaseWhere(url);
  const sql = `
    SELECT
      b.status_grupo::text AS status_grupo,
      coalesce(sum(b.total_comprado), 0)::numeric(15,2) AS valor,
      count(*)::bigint AS qtd_contratos
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY b.status_grupo
    ORDER BY valor DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    status_grupo: String(row.status_grupo ?? "—"),
    valor: Number(row.valor ?? 0),
    qtd_contratos: Number(row.qtd_contratos ?? 0),
  }));
}

export type TcClienteTopRow = {
  cliente: string;
  score_prioridade_medio: number;
  risco_financeiro_valor: number;
  risco_silencioso_valor: number;
  oportunidade_recuperacao_valor: number;
  ultima_compra: string | null;
  qtd_ctes: number;
  total_volumes: number;
  proxima_acao: string | null;
};

export async function selectTcTopClientes(pool: Pool, url: URL): Promise<TcClienteTopRow[]> {
  const w = buildTcBaseWhere(url);
  const lim = BI_TABELAS_COMBINADAS_CONFIG.topClientesLimit;
  const sql = `
    SELECT
      b.cliente::text AS cliente,
      coalesce(avg(b.score_prioridade), 0)::numeric(10,2) AS score_prioridade_medio,
      coalesce(sum(b.risco_financeiro_valor), 0)::numeric(15,2) AS risco_financeiro_valor,
      coalesce(sum(b.risco_silencioso_valor), 0)::numeric(15,2) AS risco_silencioso_valor,
      coalesce(sum(b.oportunidade_recuperacao_valor), 0)::numeric(15,2) AS oportunidade_recuperacao_valor,
      max(b.ultima_compra)::date AS ultima_compra,
      coalesce(sum(b.qtd_ctes), 0)::bigint AS qtd_ctes,
      coalesce(sum(b.total_volumes), 0)::bigint AS total_volumes,
      max(b.proxima_acao)::text AS proxima_acao
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY b.cliente, b.cliente_normalizado
    ORDER BY coalesce(avg(b.score_prioridade), 0) DESC NULLS LAST, coalesce(sum(b.oportunidade_recuperacao_valor), 0) DESC
    LIMIT ${lim}
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    cliente: String(row.cliente ?? ""),
    score_prioridade_medio: Number(row.score_prioridade_medio ?? 0),
    risco_financeiro_valor: Number(row.risco_financeiro_valor ?? 0),
    risco_silencioso_valor: Number(row.risco_silencioso_valor ?? 0),
    oportunidade_recuperacao_valor: Number(row.oportunidade_recuperacao_valor ?? 0),
    ultima_compra: row.ultima_compra ? String(row.ultima_compra).slice(0, 10) : null,
    qtd_ctes: Number(row.qtd_ctes ?? 0),
    total_volumes: Number(row.total_volumes ?? 0),
    proxima_acao: row.proxima_acao ? String(row.proxima_acao) : null,
  }));
}

export async function selectTcPipeline(
  pool: Pool,
  url: URL,
): Promise<Array<{ pipeline_fase: string; pipeline_ordem: number; qtd_contratos: number; total_comprado: number }>> {
  const w = buildTcBaseWhere(url);
  const sql = `
    SELECT
      b.pipeline_fase::text AS pipeline_fase,
      b.pipeline_ordem::int AS pipeline_ordem,
      count(*)::bigint AS qtd_contratos,
      coalesce(sum(b.total_comprado), 0)::numeric(15,2) AS total_comprado
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY b.pipeline_ordem, b.pipeline_fase
    ORDER BY b.pipeline_ordem ASC
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    pipeline_fase: String(row.pipeline_fase ?? ""),
    pipeline_ordem: Number(row.pipeline_ordem ?? 0),
    qtd_contratos: Number(row.qtd_contratos ?? 0),
    total_comprado: Number(row.total_comprado ?? 0),
  }));
}

export async function selectTcTable(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; meta: { periodApplied: { from: string; to: string }; limit: number; offset: number } }> {
  const w = buildTcBaseWhere(url);
  const period = resolveTcPeriod(url);
  let limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") || BI_TABELAS_COMBINADAS_CONFIG.tableDefaultLimit) || 1),
    BI_TABELAS_COMBINADAS_CONFIG.tableMaxLimit,
  );
  let offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  const sql = `
    SELECT
      b.status_atual::text AS status_atual,
      b.proxima_acao::text AS proxima_acao,
      b.dias_vencimento::int AS dias_p_vencer,
      b.cliente::text AS cliente,
      b.tabela_nome::text AS tabela,
      b.ultima_compra::date AS ultima_compra,
      b.total_comprado::numeric(15,2) AS ltv_valor,
      b.qtd_ctes::bigint AS qtd_ctes,
      b.total_volumes::bigint AS total_volumes,
      b.media_ticket::numeric(15,2) AS media_ticket,
      b.vendedor::text AS vendedor,
      b.score_prioridade::numeric(10,2) AS score_prioridade,
      b.prioridade_status::int AS prioridade_status
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
    ORDER BY b.prioridade_status ASC, b.score_prioridade DESC NULLS LAST, b.dias_vencimento ASC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;
  const r = await pool.query(sql, w.values);
  const rows = (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, meta: { periodApplied: period, limit, offset } };
}

/** Exportação: mesmas colunas/ordem da tabela na tela, filtros da URL, até `exportMaxRows` linhas (sem offset). */
export async function selectTcTableExportRows(
  pool: Pool,
  url: URL,
  opts?: { maxRows?: number },
): Promise<{ rows: Record<string, unknown>[] }> {
  const w = buildTcBaseWhere(url);
  const cap = BI_TABELAS_COMBINADAS_CONFIG.exportMaxRows;
  const requested = Number(opts?.maxRows ?? cap) || cap;
  const maxRows = Math.min(Math.max(1, requested), 25_000);
  const li = w.values.length + 1;
  const sql = `
    SELECT
      b.status_atual::text AS status_atual,
      b.proxima_acao::text AS proxima_acao,
      b.dias_vencimento::int AS dias_p_vencer,
      b.cliente::text AS cliente,
      b.tabela_nome::text AS tabela,
      b.ultima_compra::date AS ultima_compra,
      b.total_comprado::numeric(15,2) AS ltv_valor,
      b.qtd_ctes::bigint AS qtd_ctes,
      b.total_volumes::bigint AS total_volumes,
      b.media_ticket::numeric(15,2) AS media_ticket,
      b.vendedor::text AS vendedor
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
    ORDER BY b.prioridade_status ASC, b.score_prioridade DESC NULLS LAST, b.dias_vencimento ASC NULLS LAST
    LIMIT $${li}::int
  `;
  const r = await pool.query(sql, [...w.values, maxRows]);
  const rows = (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows };
}

export async function selectTcDrill(pool: Pool, url: URL, cliente: string): Promise<Record<string, unknown>[]> {
  const w = buildTcBaseWhere(url);
  const values = [...w.values, cliente.trim()];
  const sql = `
    SELECT
      b.cliente::text AS cliente,
      b.vendedor::text AS vendedor,
      b.status_atual::text AS status_atual,
      b.status_grupo::text AS status_grupo,
      b.proxima_acao::text AS proxima_acao,
      b.score_prioridade::numeric(10,2) AS score_prioridade,
      b.tabela_nome::text AS tabela,
      b.validade::date AS validade,
      b.ultima_compra::date AS ultima_compra,
      b.dias_vencimento::int AS dias_vencimento,
      b.total_comprado::numeric(15,2) AS ltv_valor,
      b.qtd_ctes::bigint AS qtd_ctes,
      b.total_volumes::bigint AS total_volumes,
      b.media_ticket::numeric(15,2) AS media_ticket,
      b.risco_financeiro_valor::numeric(15,2) AS risco_financeiro_valor,
      b.risco_silencioso_valor::numeric(15,2) AS risco_silencioso_valor,
      b.oportunidade_recuperacao_valor::numeric(15,2) AS oportunidade_recuperacao_valor,
      b.pipeline_fase::text AS pipeline_fase,
      b.dias_sem_compra::int AS dias_sem_compra
    FROM ${BI_TABELAS_COMBINADAS_CONFIG.baseView} b
    WHERE ${w.sql}
      AND b.cliente = $${values.length}::text
    ORDER BY b.prioridade_status ASC, b.score_prioridade DESC NULLS LAST, b.dias_vencimento ASC
    LIMIT 200
  `;
  const r = await pool.query(sql, values);
  return (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
}
