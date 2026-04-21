/**
 * BI Monitor de fluxo — leituras agregadas sobre `bi.vw_fluxo_base` com filtros consistentes (período + agência + tipo + perfil).
 */
import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { BI_FLUXO_CONFIG } from "@/modules/bi/fluxo/config";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolveFluxoPeriod(url: URL): { from: string; to: string } {
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

export type FluxoWhere = { sql: string; values: unknown[] };

export type FluxoWhereOptions = {
  /** Para montar listas de filtro sem “fechar” a própria dimensão (cascata). */
  omitAgencia?: boolean;
  omitTipoFluxo?: boolean;
  omitPerfil?: boolean;
};

/** Predicados sobre alias `b` (`bi.vw_fluxo_base`). */
export function buildFluxoBaseWhere(url: URL, opts?: FluxoWhereOptions): FluxoWhere {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolveFluxoPeriod(url);
  values.push(from, to);
  /** `mes_referencia` é mês cheio na base; alinhar ao envelope do mês evita sumir linhas quando início/fim não caem no dia 1. */
  parts.push(
    `b.mes_referencia >= date_trunc('month', $1::date)::date AND b.mes_referencia < (date_trunc('month', $2::date) + interval '1 month')::date`,
  );

  const F = BI_FLUXO_CONFIG.filters;
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

  if (!opts?.omitTipoFluxo) {
    const tipos = collectMulti(url, F.tipoFluxo)
      .map((v) => v.trim())
      .filter(Boolean);
    if (tipos.length) {
      if (tipos.length === 1) {
        values.push(tipos[0]);
        parts.push(`b.status_fluxo = $${values.length}::text`);
      } else {
        values.push(tipos);
        parts.push(`b.status_fluxo = ANY($${values.length}::text[])`);
      }
    }
  }

  if (!opts?.omitPerfil) {
    const perfis = collectMulti(url, F.perfil)
      .map((v) => v.trim())
      .filter(Boolean);
    if (perfis.length) {
      if (perfis.length === 1) {
        values.push(perfis[0]);
        parts.push(`b.cluster_perfil = $${values.length}::text`);
      } else {
        values.push(perfis);
        parts.push(`b.cluster_perfil = ANY($${values.length}::text[])`);
      }
    }
  }

  return { sql: parts.join(" AND "), values };
}

/** Drill: `bi.vw_fluxo_drill_agencia` + período + tipo + perfil + agência clicada (ignora multiselect de agência na URL). */
function buildFluxoDrillWhere(url: URL, clickedAgencia: string): FluxoWhere {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolveFluxoPeriod(url);
  values.push(from, to);
  parts.push(
    `d.mes_referencia >= date_trunc('month', $1::date)::date AND d.mes_referencia < (date_trunc('month', $2::date) + interval '1 month')::date`,
  );

  const F = BI_FLUXO_CONFIG.filters;
  const tipos = collectMulti(url, F.tipoFluxo)
    .map((v) => v.trim())
    .filter(Boolean);
  if (tipos.length) {
    if (tipos.length === 1) {
      values.push(tipos[0]);
      parts.push(`d.status_fluxo = $${values.length}::text`);
    } else {
      values.push(tipos);
      parts.push(`d.status_fluxo = ANY($${values.length}::text[])`);
    }
  }

  const perfis = collectMulti(url, F.perfil)
    .map((v) => v.trim())
    .filter(Boolean);
  if (perfis.length) {
    if (perfis.length === 1) {
      values.push(perfis[0]);
      parts.push(`d.cluster_perfil = $${values.length}::text`);
    } else {
      values.push(perfis);
      parts.push(`d.cluster_perfil = ANY($${values.length}::text[])`);
    }
  }

  values.push(clickedAgencia.trim());
  parts.push(`upper(trim(d.agencia::text)) = upper(trim($${values.length}::text))`);

  return { sql: parts.join(" AND "), values };
}

export async function selectFluxoKpis(pool: Pool, url: URL): Promise<Record<string, unknown>> {
  const w = buildFluxoBaseWhere(url);
  const sql = `
    SELECT
      coalesce(sum(b.qtd_emissoes), 0)::bigint AS qtd_emissoes,
      coalesce(sum(b.volume_total), 0)::bigint AS cargas_transportadas,
      CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(15,2)
           ELSE (sum(b.ticket_medio * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(15,2) END AS ticket_medio_global,
      CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(10,2)
           ELSE (sum(b.score_hub * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(10,2) END AS score_hub_medio,
      CASE WHEN count(*) = 0 THEN 0::numeric
           ELSE count(*) FILTER (WHERE b.status_fluxo = 'EQUILIBRADA'::text)::numeric / count(*)::numeric END AS percentual_rede_equilibrada,
      CASE WHEN count(*) = 0 THEN 0::numeric
           ELSE count(*) FILTER (WHERE b.status_fluxo = 'RECEPTORA'::text)::numeric / count(*)::numeric END AS percentual_rede_receptora
    FROM ${BI_FLUXO_CONFIG.baseView} b
    WHERE ${w.sql}
  `;
  const r = await pool.query(sql, w.values);
  return serializePgRow((r.rows?.[0] ?? {}) as Record<string, unknown>);
}

export async function selectFluxoFacetOptions(
  poolConn: Pool,
  url: URL,
): Promise<{
  agencias: string[];
  tiposFluxo: string[];
  perfis: string[];
}> {
  /** Listas de multiselect só pelo período — alinham à tabela “sem filtros” e evitam cascata esvaziar opções. */
  const w = buildFluxoBaseWhere(url, { omitAgencia: true, omitTipoFluxo: true, omitPerfil: true });

  const [aRes, tRes, pRes] = await Promise.all([
    poolConn.query(
      `SELECT trim(max(b.agencia::text)) AS v
       FROM ${BI_FLUXO_CONFIG.baseView} b
       WHERE ${w.sql} AND trim(b.agencia::text) <> ''
       GROUP BY b.agencia_normalizada
       ORDER BY 1
       LIMIT 800`,
      w.values,
    ),
    poolConn.query(
      `SELECT DISTINCT trim(b.status_fluxo::text) AS v
       FROM ${BI_FLUXO_CONFIG.baseView} b
       WHERE ${w.sql} AND b.status_fluxo IS NOT NULL AND trim(b.status_fluxo::text) <> ''
       ORDER BY 1
       LIMIT 120`,
      w.values,
    ),
    poolConn.query(
      `SELECT DISTINCT trim(b.cluster_perfil::text) AS v
       FROM ${BI_FLUXO_CONFIG.baseView} b
       WHERE ${w.sql} AND trim(b.cluster_perfil::text) <> ''
       ORDER BY 1
       LIMIT 120`,
      w.values,
    ),
  ]);

  const mapV = (rows: { v: unknown }[]) =>
    (rows || []).map((x) => String(x.v ?? "").trim()).filter(Boolean);

  const uniqSort = (arr: string[]) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    agencias: uniqSort(mapV((aRes.rows || []) as { v: unknown }[])),
    tiposFluxo: uniqSort(mapV((tRes.rows || []) as { v: unknown }[])),
    perfis: uniqSort(mapV((pRes.rows || []) as { v: unknown }[])),
  };
}

export async function selectFluxoAgenciaBalance(
  pool: Pool,
  url: URL,
): Promise<Array<{ agencia: string; qtd_emissoes: number; qtd_recebimentos: number; volume_total: number }>> {
  const w = buildFluxoBaseWhere(url);
  const sql = `
    SELECT
      trim(b.agencia::text) AS agencia,
      coalesce(sum(b.qtd_emissoes), 0)::bigint AS qtd_emissoes,
      coalesce(sum(b.qtd_recebimentos), 0)::bigint AS qtd_recebimentos,
      coalesce(sum(b.volume_total), 0)::bigint AS volume_total
    FROM ${BI_FLUXO_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY 1
    ORDER BY coalesce(sum(b.volume_total), 0) DESC NULLS LAST
    LIMIT 18
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    agencia: String(row.agencia ?? ""),
    qtd_emissoes: Number(row.qtd_emissoes ?? 0),
    qtd_recebimentos: Number(row.qtd_recebimentos ?? 0),
    volume_total: Number(row.volume_total ?? 0),
  }));
}

export async function selectFluxoStatusResumo(
  pool: Pool,
  url: URL,
): Promise<Array<{ status_fluxo: string; qtd_agencias: number; volume_total: number }>> {
  const w = buildFluxoBaseWhere(url);
  const sql = `
    SELECT
      trim(b.status_fluxo::text) AS status_fluxo,
      count(DISTINCT b.agencia_normalizada)::bigint AS qtd_agencias,
      coalesce(sum(b.volume_total), 0)::bigint AS volume_total
    FROM ${BI_FLUXO_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY 1
    ORDER BY coalesce(sum(b.volume_total), 0) DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    status_fluxo: String(row.status_fluxo ?? ""),
    qtd_agencias: Number(row.qtd_agencias ?? 0),
    volume_total: Number(row.volume_total ?? 0),
  }));
}

export async function selectFluxoClusterResumo(
  pool: Pool,
  url: URL,
): Promise<Array<{ cluster_perfil: string; qtd_agencias: number; volume_total: number; score_hub_medio: number }>> {
  const w = buildFluxoBaseWhere(url);
  const sql = `
    SELECT
      trim(b.cluster_perfil::text) AS cluster_perfil,
      count(DISTINCT b.agencia_normalizada)::bigint AS qtd_agencias,
      coalesce(sum(b.volume_total), 0)::bigint AS volume_total,
      CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(10,2)
           ELSE (sum(b.score_hub * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(10,2) END AS score_hub_medio
    FROM ${BI_FLUXO_CONFIG.baseView} b
    WHERE ${w.sql}
      AND trim(coalesce(b.cluster_perfil::text, '')) <> ''
    GROUP BY 1
    ORDER BY coalesce(sum(b.volume_total), 0) DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    cluster_perfil: String(row.cluster_perfil ?? ""),
    qtd_agencias: Number(row.qtd_agencias ?? 0),
    volume_total: Number(row.volume_total ?? 0),
    score_hub_medio: Number(row.score_hub_medio ?? 0),
  }));
}

export async function selectFluxoEvolucaoMensal(
  pool: Pool,
  url: URL,
): Promise<
  Array<{
    mes_referencia: string;
    volume_total: number;
    qtd_emissoes: number;
    qtd_recebimentos: number;
    ticket_medio_global: number;
    score_hub_medio: number;
  }>
> {
  const w = buildFluxoBaseWhere(url);
  const sql = `
    SELECT
      b.mes_referencia::text AS mes_referencia,
      coalesce(sum(b.volume_total), 0)::bigint AS volume_total,
      coalesce(sum(b.qtd_emissoes), 0)::bigint AS qtd_emissoes,
      coalesce(sum(b.qtd_recebimentos), 0)::bigint AS qtd_recebimentos,
      CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(15,2)
           ELSE (sum(b.ticket_medio * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(15,2) END AS ticket_medio_global,
      CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(10,2)
           ELSE (sum(b.score_hub * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(10,2) END AS score_hub_medio
    FROM ${BI_FLUXO_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY b.mes_referencia
    ORDER BY b.mes_referencia ASC
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    mes_referencia: String(row.mes_referencia ?? "").slice(0, 10),
    volume_total: Number(row.volume_total ?? 0),
    qtd_emissoes: Number(row.qtd_emissoes ?? 0),
    qtd_recebimentos: Number(row.qtd_recebimentos ?? 0),
    ticket_medio_global: Number(row.ticket_medio_global ?? 0),
    score_hub_medio: Number(row.score_hub_medio ?? 0),
  }));
}

export async function selectFluxoTable(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; meta: { limit: number; offset: number; total: number } }> {
  const w = buildFluxoBaseWhere(url);
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") || BI_FLUXO_CONFIG.tableDefaultLimit) || 1),
    BI_FLUXO_CONFIG.tableMaxLimit,
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  const countSql = `
    SELECT count(*)::bigint AS c
    FROM (
      SELECT b.agencia_normalizada
      FROM ${BI_FLUXO_CONFIG.baseView} b
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
        trim(max(b.agencia::text)) AS agencia,
        coalesce(sum(b.qtd_emissoes), 0)::bigint AS qtd_emissoes,
        coalesce(sum(b.qtd_recebimentos), 0)::bigint AS qtd_recebimentos,
        coalesce(sum(b.volume_total), 0)::bigint AS volume_total,
        CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(15,2)
             ELSE (sum(b.ticket_medio * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(15,2) END AS ticket_medio,
        CASE WHEN coalesce(sum(b.qtd_recebimentos), 0) = 0 THEN 0::numeric(10,4)
             ELSE (sum(b.qtd_emissoes)::numeric / nullif(sum(b.qtd_recebimentos), 0)::numeric) END AS razao_fluxo,
        (array_agg(b.status_fluxo ORDER BY b.mes_referencia DESC))[1]::text AS status_fluxo,
        (array_agg(b.cluster_perfil ORDER BY b.mes_referencia DESC))[1]::text AS cluster_perfil,
        CASE WHEN coalesce(sum(b.volume_total), 0) = 0 THEN 0::numeric(10,2)
             ELSE (sum(b.score_hub * b.volume_total::numeric) / nullif(sum(b.volume_total), 0)::numeric)::numeric(10,2) END AS score_hub,
        (coalesce(sum(b.qtd_recebimentos), 0) - coalesce(sum(b.qtd_emissoes), 0))::bigint AS saldo_fluxo_qtd
      FROM ${BI_FLUXO_CONFIG.baseView} b
      WHERE ${w.sql}
      GROUP BY b.agencia_normalizada
    )
    SELECT * FROM agg
    ORDER BY volume_total DESC NULLS LAST, agencia ASC
    LIMIT $${li}::int OFFSET $${lo}::int
  `;
  const r = await pool.query(sql, [...w.values, limit, offset]);
  const rows = (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, meta: { limit, offset, total } };
}

export async function selectFluxoDrillAgencia(
  pool: Pool,
  url: URL,
  agencia: string,
): Promise<Record<string, unknown>[]> {
  const w = buildFluxoDrillWhere(url, agencia);
  const sql = `
    SELECT
      trim(d.agencia::text) AS agencia,
      d.mes_referencia::text AS mes_referencia,
      d.qtd_emissoes::bigint AS qtd_emissoes,
      d.qtd_recebimentos::bigint AS qtd_recebimentos,
      d.volume_total::bigint AS volume_total,
      d.valor_total_emitido::numeric(15,2) AS valor_total_emitido,
      d.valor_total_recebido::numeric(15,2) AS valor_total_recebido,
      d.saldo_fluxo_qtd::bigint AS saldo_fluxo_qtd,
      d.saldo_fluxo_valor::numeric(15,2) AS saldo_fluxo_valor,
      d.ticket_medio::numeric(15,2) AS ticket_medio,
      d.razao_fluxo::numeric(10,4) AS razao_fluxo,
      trim(d.status_fluxo::text) AS status_fluxo,
      trim(d.cluster_perfil::text) AS cluster_perfil,
      d.score_hub::numeric(10,2) AS score_hub
    FROM bi.vw_fluxo_drill_agencia d
    WHERE ${w.sql}
    ORDER BY d.mes_referencia DESC
    LIMIT 120
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
}
