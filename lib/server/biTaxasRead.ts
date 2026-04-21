/**
 * BI Gestão de taxas — leituras sobre `bi.vw_taxas_*` com filtros consistentes (período + agência + perfil + serviço extra).
 */
import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { BI_TAXAS_CONFIG } from "@/modules/bi/taxas/config";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolveTaxasPeriod(url: URL): { from: string; to: string } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    if (from > to) return { from: to, to: from };
    return { from, to };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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

export type TaxasWhere = { sql: string; values: unknown[] };

export type TaxasWhereOptions = {
  omitAgencia?: boolean;
  omitPerfil?: boolean;
  omitServico?: boolean;
};

const SERVICO_LABELS = new Set(["Coleta", "Entrega", "Outros", "Pedágio", "SECCAT", "Sem taxas"]);

function appendServicoExtraFilter(parts: string[], values: unknown[], alias: string, servicos: string[]): void {
  const valid = servicos.filter((s) => SERVICO_LABELS.has(s));
  if (!valid.length) return;
  const sub: string[] = [];
  for (const s of valid) {
    if (s === "Coleta") sub.push(`coalesce(${alias}.receita_coleta, 0) > 0`);
    else if (s === "Entrega") sub.push(`coalesce(${alias}.receita_entrega, 0) > 0`);
    else if (s === "Outros") sub.push(`coalesce(${alias}.receita_outros, 0) > 0`);
    else if (s === "Pedágio") sub.push(`coalesce(${alias}.receita_pedagio, 0) > 0`);
    else if (s === "SECCAT") sub.push(`coalesce(${alias}.receita_seccat, 0) > 0`);
    else if (s === "Sem taxas") {
      sub.push(
        `(coalesce(${alias}.receita_coleta,0) = 0 AND coalesce(${alias}.receita_entrega,0) = 0 AND coalesce(${alias}.receita_outros,0) = 0 AND coalesce(${alias}.receita_pedagio,0) = 0 AND coalesce(${alias}.receita_seccat,0) = 0)`,
      );
    }
  }
  if (!sub.length) return;
  parts.push(`(${sub.join(" OR ")})`);
}

/** Predicados sobre `bi.vw_taxas_base` (alias `b`). */
export function buildTaxasBaseWhere(url: URL, opts?: TaxasWhereOptions): TaxasWhere {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolveTaxasPeriod(url);
  values.push(from, to);
  parts.push(
    `b.mes_referencia >= date_trunc('month', $1::date)::date AND b.mes_referencia < (date_trunc('month', $2::date) + interval '1 month')::date`,
  );

  const F = BI_TAXAS_CONFIG.filters;
  if (!opts?.omitAgencia) {
    const ags = collectMulti(url, F.agencia)
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
    if (ags.length) {
      if (ags.length === 1) {
        values.push(ags[0]);
        parts.push(`b.agencia_normalizada = $${values.length}::text`);
      } else {
        values.push(ags);
        parts.push(`b.agencia_normalizada = ANY($${values.length}::text[])`);
      }
    }
  }

  if (!opts?.omitPerfil) {
    const perfis = collectMulti(url, F.perfilCobranca)
      .map((v) => v.trim())
      .filter(Boolean);
    if (perfis.length) {
      if (perfis.length === 1) {
        values.push(perfis[0]);
        parts.push(`trim(b.perfil_cobranca::text) = $${values.length}::text`);
      } else {
        values.push(perfis);
        parts.push(`trim(b.perfil_cobranca::text) = ANY($${values.length}::text[])`);
      }
    }
  }

  if (!opts?.omitServico) {
    const serv = collectMulti(url, F.servicoExtra).map((v) => v.trim());
    appendServicoExtraFilter(parts, values, "b", serv);
  }

  return { sql: parts.join(" AND "), values };
}

/** Mesmo critério dimensional sobre `bi.vw_taxas_agencia_resumo` (alias `r`). */
function buildTaxasResumoWhere(url: URL, opts?: TaxasWhereOptions): TaxasWhere {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolveTaxasPeriod(url);
  values.push(from, to);
  parts.push(
    `r.mes_referencia >= date_trunc('month', $1::date)::date AND r.mes_referencia < (date_trunc('month', $2::date) + interval '1 month')::date`,
  );

  const F = BI_TAXAS_CONFIG.filters;
  if (!opts?.omitAgencia) {
    const ags = collectMulti(url, F.agencia)
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
    if (ags.length) {
      if (ags.length === 1) {
        values.push(ags[0]);
        parts.push(`upper(trim(r.agencia::text)) = $${values.length}::text`);
      } else {
        values.push(ags);
        parts.push(`upper(trim(r.agencia::text)) = ANY($${values.length}::text[])`);
      }
    }
  }

  if (!opts?.omitPerfil) {
    const perfis = collectMulti(url, F.perfilCobranca)
      .map((v) => v.trim())
      .filter(Boolean);
    if (perfis.length) {
      if (perfis.length === 1) {
        values.push(perfis[0]);
        parts.push(`trim(r.perfil_cobranca::text) = $${values.length}::text`);
      } else {
        values.push(perfis);
        parts.push(`trim(r.perfil_cobranca::text) = ANY($${values.length}::text[])`);
      }
    }
  }

  if (!opts?.omitServico) {
    const serv = collectMulti(url, F.servicoExtra).map((v) => v.trim());
    appendServicoExtraFilter(parts, values, "r", serv);
  }

  return { sql: parts.join(" AND "), values };
}

function buildTaxasDrillWhere(url: URL, clickedAgencia: string): TaxasWhere {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolveTaxasPeriod(url);
  values.push(from, to);
  parts.push(
    `d.mes_referencia >= date_trunc('month', $1::date)::date AND d.mes_referencia < (date_trunc('month', $2::date) + interval '1 month')::date`,
  );

  const F = BI_TAXAS_CONFIG.filters;
  const perfis = collectMulti(url, F.perfilCobranca)
    .map((v) => v.trim())
    .filter(Boolean);
  if (perfis.length) {
    if (perfis.length === 1) {
      values.push(perfis[0]);
      parts.push(`trim(d.perfil_cobranca::text) = $${values.length}::text`);
    } else {
      values.push(perfis);
      parts.push(`trim(d.perfil_cobranca::text) = ANY($${values.length}::text[])`);
    }
  }

  appendServicoExtraFilter(parts, values, "d", collectMulti(url, F.servicoExtra).map((t) => t.trim()));

  values.push(clickedAgencia.trim());
  parts.push(`upper(trim(d.agencia::text)) = upper(trim($${values.length}::text))`);

  return { sql: parts.join(" AND "), values };
}

export async function selectTaxasKpis(pool: Pool, url: URL): Promise<Record<string, unknown>> {
  const w = buildTaxasBaseWhere(url);
  const sql = `
    SELECT
      coalesce(sum(b.receita_extras_total), 0)::numeric(15,2) AS receita_servicos_extras,
      coalesce(sum(b.faturamento_total), 0)::numeric(15,2) AS faturamento_total_analisado,
      CASE WHEN coalesce(sum(b.faturamento_total), 0::numeric) = 0::numeric THEN 0::numeric
           ELSE sum(b.receita_extras_total) / sum(b.faturamento_total) END AS impacto_faturamento_percentual,
      CASE WHEN coalesce(sum(b.qtd_emissoes + b.qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric
           ELSE sum(b.receita_extras_total) / sum(b.qtd_emissoes + b.qtd_recebimentos)::numeric END AS ticket_medio_extras,
      CASE WHEN coalesce(sum(b.qtd_emissoes), 0::bigint) = 0 THEN 0::numeric
           ELSE sum(b.qtd_cobrada_coleta)::numeric / sum(b.qtd_emissoes)::numeric END AS penetracao_coleta_global,
      CASE WHEN coalesce(sum(b.qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric
           ELSE sum(b.qtd_cobrada_entrega)::numeric / sum(b.qtd_recebimentos)::numeric END AS penetracao_entrega_global
    FROM ${BI_TAXAS_CONFIG.baseView} b
    WHERE ${w.sql}
  `;
  const r = await pool.query(sql, w.values);
  return serializePgRow((r.rows?.[0] ?? {}) as Record<string, unknown>);
}

export async function selectTaxasFacetOptions(
  poolConn: Pool,
  url: URL,
): Promise<{ agencias: string[]; perfis: string[]; servicos: string[] }> {
  const w = buildTaxasBaseWhere(url, { omitAgencia: true, omitPerfil: true, omitServico: true });

  const [aRes, pRes, sRes] = await Promise.all([
    poolConn.query(
      `SELECT trim(max(b.agencia::text)) AS v
       FROM ${BI_TAXAS_CONFIG.baseView} b
       WHERE ${w.sql} AND trim(b.agencia::text) <> ''
       GROUP BY b.agencia_normalizada
       ORDER BY 1
       LIMIT 800`,
      w.values,
    ),
    poolConn.query(
      `SELECT DISTINCT trim(b.perfil_cobranca::text) AS v
       FROM ${BI_TAXAS_CONFIG.baseView} b
       WHERE ${w.sql} AND trim(b.perfil_cobranca::text) <> ''
       ORDER BY 1
       LIMIT 120`,
      w.values,
    ),
    poolConn.query(
      `SELECT DISTINCT trim(f.selecao_taxas::text) AS v
       FROM ${BI_TAXAS_CONFIG.filtersView} f
       WHERE f.mes_referencia >= date_trunc('month', $1::date)::date
         AND f.mes_referencia < (date_trunc('month', $2::date) + interval '1 month')::date
         AND trim(f.selecao_taxas::text) <> ''
       ORDER BY 1
       LIMIT 30`,
      w.values,
    ),
  ]);

  const mapV = (rows: { v: unknown }[]) =>
    (rows || []).map((x) => String(x.v ?? "").trim()).filter(Boolean);
  const uniqSort = (arr: string[]) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    agencias: uniqSort(mapV((aRes.rows || []) as { v: unknown }[])),
    perfis: uniqSort(mapV((pRes.rows || []) as { v: unknown }[])),
    servicos: uniqSort(mapV((sRes.rows || []) as { v: unknown }[])),
  };
}

export async function selectTaxasComposicao(
  pool: Pool,
  url: URL,
): Promise<Array<{ servico: string; receita: number }>> {
  const w = buildTaxasBaseWhere(url);
  const sql = `
    SELECT 'Coleta'::text AS servico, coalesce(sum(b.receita_coleta), 0)::numeric(15,2) AS receita
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'Entrega', coalesce(sum(b.receita_entrega), 0)::numeric(15,2)
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'Outros', coalesce(sum(b.receita_outros), 0)::numeric(15,2)
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'Pedágio', coalesce(sum(b.receita_pedagio), 0)::numeric(15,2)
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'SECCAT', coalesce(sum(b.receita_seccat), 0)::numeric(15,2)
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
  `;
  /** Cada ramo reutiliza os mesmos `$1…$n` de `w.sql` — um único vector de parâmetros. */
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    servico: String(row.servico ?? ""),
    receita: Number(row.receita ?? 0),
  }));
}

export async function selectTaxasTmServico(
  pool: Pool,
  url: URL,
): Promise<Array<{ servico: string; ticket_medio: number }>> {
  const w = buildTaxasBaseWhere(url);
  const sql = `
    SELECT 'TM Coleta'::text AS servico,
      CASE WHEN sum(b.qtd_cobrada_coleta) = 0 THEN 0::numeric
           ELSE (sum(b.receita_coleta) / sum(b.qtd_cobrada_coleta)::numeric)::numeric(15,2) END AS ticket_medio
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'TM Entrega',
      CASE WHEN sum(b.qtd_cobrada_entrega) = 0 THEN 0::numeric
           ELSE (sum(b.receita_entrega) / sum(b.qtd_cobrada_entrega)::numeric)::numeric(15,2) END
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'TM Outros',
      CASE WHEN sum(b.qtd_cobrada_outros) = 0 THEN 0::numeric
           ELSE (sum(b.receita_outros) / sum(b.qtd_cobrada_outros)::numeric)::numeric(15,2) END
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'TM Pedágio',
      CASE WHEN sum(b.qtd_recebimentos) = 0 THEN 0::numeric
           ELSE (sum(b.receita_pedagio) / sum(b.qtd_recebimentos)::numeric)::numeric(15,2) END
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
    UNION ALL
    SELECT 'TM SECCAT',
      CASE WHEN sum(b.qtd_recebimentos) = 0 THEN 0::numeric
           ELSE (sum(b.receita_seccat) / sum(b.qtd_recebimentos)::numeric)::numeric(15,2) END
    FROM ${BI_TAXAS_CONFIG.baseView} b WHERE ${w.sql}
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    servico: String(row.servico ?? ""),
    ticket_medio: Number(row.ticket_medio ?? 0),
  }));
}

export async function selectTaxasEvolucaoMensal(
  pool: Pool,
  url: URL,
): Promise<
  Array<{
    mes_referencia: string;
    receita_extras_total: number;
    pct_representatividade_extras: number;
    pct_penetracao_entrega_global: number;
    pct_penetracao_coleta_global: number;
  }>
> {
  const w = buildTaxasBaseWhere(url);
  const sql = `
    SELECT
      b.mes_referencia::text AS mes_referencia,
      coalesce(sum(b.receita_extras_total), 0)::numeric(15,2) AS receita_extras_total,
      CASE WHEN coalesce(sum(b.faturamento_total), 0::numeric) = 0::numeric THEN 0::numeric
           ELSE sum(b.receita_extras_total) / sum(b.faturamento_total) END AS pct_representatividade_extras,
      CASE WHEN coalesce(sum(b.qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric
           ELSE sum(b.qtd_cobrada_entrega)::numeric / sum(b.qtd_recebimentos)::numeric END AS pct_penetracao_entrega_global,
      CASE WHEN coalesce(sum(b.qtd_emissoes), 0::bigint) = 0 THEN 0::numeric
           ELSE sum(b.qtd_cobrada_coleta)::numeric / sum(b.qtd_emissoes)::numeric END AS pct_penetracao_coleta_global
    FROM ${BI_TAXAS_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY b.mes_referencia
    ORDER BY b.mes_referencia ASC
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    mes_referencia: String(row.mes_referencia ?? "").slice(0, 10),
    receita_extras_total: Number(row.receita_extras_total ?? 0),
    pct_representatividade_extras: Number(row.pct_representatividade_extras ?? 0),
    pct_penetracao_entrega_global: Number(row.pct_penetracao_entrega_global ?? 0),
    pct_penetracao_coleta_global: Number(row.pct_penetracao_coleta_global ?? 0),
  }));
}

export async function selectTaxasRankingOportunidade(
  pool: Pool,
  url: URL,
  limit = 12,
): Promise<
  Array<{
    agencia: string;
    faturamento_total: number;
    receita_extras: number;
    pct_penetracao_entrega: number;
    pct_penetracao_coleta: number;
    score_oportunidade: number;
  }>
> {
  const w = buildTaxasBaseWhere(url);
  const sql = `
    WITH agg AS (
      SELECT
        trim(max(b.agencia::text)) AS agencia,
        coalesce(sum(b.faturamento_total), 0)::numeric(15,2) AS faturamento_total,
        coalesce(sum(b.receita_extras_total), 0)::numeric(15,2) AS receita_extras,
        CASE WHEN coalesce(sum(b.qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric
             ELSE sum(b.qtd_cobrada_entrega)::numeric / sum(b.qtd_recebimentos)::numeric END AS pct_penetracao_entrega,
        CASE WHEN coalesce(sum(b.qtd_emissoes), 0::bigint) = 0 THEN 0::numeric
             ELSE sum(b.qtd_cobrada_coleta)::numeric / sum(b.qtd_emissoes)::numeric END AS pct_penetracao_coleta
      FROM ${BI_TAXAS_CONFIG.baseView} b
      WHERE ${w.sql}
      GROUP BY b.agencia_normalizada
    )
    SELECT
      agencia,
      faturamento_total::float8 AS faturamento_total,
      receita_extras::float8 AS receita_extras,
      pct_penetracao_entrega::float8 AS pct_penetracao_entrega,
      pct_penetracao_coleta::float8 AS pct_penetracao_coleta,
      (
        (faturamento_total::numeric / 100000::numeric)
        * (1::numeric - least(1::numeric, (pct_penetracao_entrega + pct_penetracao_coleta) / 2::numeric))
      )::float8 AS score_oportunidade
    FROM agg
    WHERE faturamento_total > 0
    ORDER BY score_oportunidade DESC NULLS LAST, faturamento_total DESC NULLS LAST
    LIMIT $${w.values.length + 1}::int
  `;
  const r = await pool.query(sql, [...w.values, limit]);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    agencia: String(row.agencia ?? ""),
    faturamento_total: Number(row.faturamento_total ?? 0),
    receita_extras: Number(row.receita_extras ?? 0),
    pct_penetracao_entrega: Number(row.pct_penetracao_entrega ?? 0),
    pct_penetracao_coleta: Number(row.pct_penetracao_coleta ?? 0),
    score_oportunidade: Number(row.score_oportunidade ?? 0),
  }));
}

export async function selectTaxasTable(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; meta: { limit: number; offset: number; total: number } }> {
  const w = buildTaxasResumoWhere(url);
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") || BI_TAXAS_CONFIG.tableDefaultLimit) || 1),
    BI_TAXAS_CONFIG.tableMaxLimit,
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  const countSql = `
    SELECT count(*)::bigint AS c
    FROM (
      SELECT upper(trim(r.agencia::text)) AS k
      FROM ${BI_TAXAS_CONFIG.agenciaResumoView} r
      WHERE ${w.sql}
      GROUP BY 1
    ) t
  `;
  const cRes = await pool.query(countSql, w.values);
  const total = Number((cRes.rows?.[0] as { c?: unknown })?.c ?? 0);

  const li = w.values.length + 1;
  const lo = w.values.length + 2;
  const sql = `
    WITH agg AS (
      SELECT
        upper(trim(r.agencia::text)) AS agencia_key,
        trim(max(r.agencia::text)) AS agencia,
        coalesce(sum(r.receita_extras_total), 0)::numeric(15,2) AS receita_servicos_extras,
        CASE WHEN coalesce(sum(r.faturamento_total), 0::numeric) = 0::numeric THEN 0::numeric
             ELSE sum(r.receita_extras_total) / sum(r.faturamento_total) END AS pct_representatividade_extras,
        CASE WHEN coalesce(sum(r.qtd_cobrada_entrega), 0::bigint) = 0 THEN 0::numeric
             ELSE sum(r.receita_entrega) / sum(r.qtd_cobrada_entrega)::numeric END AS tm_entrega,
        (array_agg(r.status_cobranca_entrega ORDER BY r.mes_referencia DESC))[1]::text AS status_cobranca_entrega,
        CASE WHEN coalesce(sum(r.qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric
             ELSE sum(r.qtd_cobrada_entrega)::numeric / sum(r.qtd_recebimentos)::numeric END AS pct_penetracao_entrega,
        CASE WHEN coalesce(sum(r.qtd_cobrada_coleta), 0::bigint) = 0 THEN 0::numeric
             ELSE sum(r.receita_coleta) / sum(r.qtd_cobrada_coleta)::numeric END AS tm_coleta,
        (array_agg(r.status_cobranca_coleta ORDER BY r.mes_referencia DESC))[1]::text AS status_cobranca_coleta,
        CASE WHEN coalesce(sum(r.qtd_emissoes), 0::bigint) = 0 THEN 0::numeric
             ELSE sum(r.qtd_cobrada_coleta)::numeric / sum(r.qtd_emissoes)::numeric END AS pct_penetracao_coleta,
        (array_agg(trim(r.perfil_cobranca::text) ORDER BY r.mes_referencia DESC))[1]::text AS perfil_cobranca,
        coalesce(sum(r.faturamento_total), 0)::numeric(15,2) AS faturamento_total
      FROM ${BI_TAXAS_CONFIG.agenciaResumoView} r
      WHERE ${w.sql}
      GROUP BY upper(trim(r.agencia::text))
    )
    SELECT
      agencia,
      receita_servicos_extras,
      pct_representatividade_extras,
      tm_entrega,
      status_cobranca_entrega,
      pct_penetracao_entrega,
      tm_coleta,
      status_cobranca_coleta,
      pct_penetracao_coleta,
      perfil_cobranca,
      faturamento_total
    FROM agg
    ORDER BY faturamento_total DESC NULLS LAST, agencia ASC
    LIMIT $${li}::int OFFSET $${lo}::int
  `;
  const r = await pool.query(sql, [...w.values, limit, offset]);
  const rows = (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, meta: { limit, offset, total } };
}

export async function selectTaxasDrillAgencia(
  pool: Pool,
  url: URL,
  agencia: string,
): Promise<Record<string, unknown>[]> {
  const w = buildTaxasDrillWhere(url, agencia);
  const sql = `
    SELECT
      trim(d.agencia::text) AS agencia,
      d.mes_referencia::text AS mes_referencia,
      d.faturamento_total::numeric(15,2) AS faturamento_total,
      d.receita_extras_total::numeric(15,2) AS receita_extras_total,
      d.pct_representatividade_extras::numeric(10,4) AS pct_representatividade_extras,
      d.receita_coleta::numeric(15,2) AS receita_coleta,
      d.qtd_cobrada_coleta::bigint AS qtd_cobrada_coleta,
      d.pct_penetracao_coleta::numeric(10,4) AS pct_penetracao_coleta,
      d.tm_coleta::numeric(15,2) AS tm_coleta,
      trim(d.status_cobranca_coleta::text) AS status_cobranca_coleta,
      d.receita_entrega::numeric(15,2) AS receita_entrega,
      d.qtd_cobrada_entrega::bigint AS qtd_cobrada_entrega,
      d.pct_penetracao_entrega::numeric(10,4) AS pct_penetracao_entrega,
      d.tm_entrega::numeric(15,2) AS tm_entrega,
      trim(d.status_cobranca_entrega::text) AS status_cobranca_entrega,
      d.receita_outros::numeric(15,2) AS receita_outros,
      d.qtd_cobrada_outros::bigint AS qtd_cobrada_outros,
      d.tm_outros::numeric(15,2) AS tm_outros,
      d.receita_pedagio::numeric(15,2) AS receita_pedagio,
      d.receita_seccat::numeric(15,2) AS receita_seccat,
      trim(d.perfil_cobranca::text) AS perfil_cobranca,
      d.qtd_emissoes::bigint AS qtd_emissoes,
      d.qtd_recebimentos::bigint AS qtd_recebimentos
    FROM ${BI_TAXAS_CONFIG.drillView} d
    WHERE ${w.sql}
    ORDER BY d.mes_referencia DESC
    LIMIT 120
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
}
