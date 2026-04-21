/**
 * BI Comercial 360 — leituras filtradas sobre `bi.vw_360_base` (não usar views agregadas sem WHERE).
 */
import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { BI_COMERCIAL_360_CONFIG } from "@/modules/bi/comercial360/config";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolve360Period(url: URL): { from: string; to: string } {
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

export type Bi360Where = { sql: string; values: unknown[] };

export type Bi360WhereOptions = {
  /** Só período — para facetas e evitar listas vazias por cascata. */
  facetPeriodOnly?: boolean;
};

function appendEqOrAny(parts: string[], values: unknown[], columnSql: string, vals: string[]): void {
  if (!vals.length) return;
  if (vals.length === 1) {
    values.push(vals[0]);
    parts.push(`${columnSql} = $${values.length}::text`);
  } else {
    values.push(vals);
    parts.push(`${columnSql} = ANY($${values.length}::text[])`);
  }
}

/** Predicados sobre `bi.vw_360_base` (alias `b`). */
export function build360BaseWhere(url: URL, opts?: Bi360WhereOptions): Bi360Where {
  const values: unknown[] = [];
  const parts: string[] = [];
  const { from, to } = resolve360Period(url);
  values.push(from, to);
  parts.push(`b.data_referencia >= $1::date AND b.data_referencia <= $2::date`);

  if (opts?.facetPeriodOnly) {
    return { sql: parts.join(" AND "), values };
  }

  const F = BI_COMERCIAL_360_CONFIG.filters;

  appendEqOrAny(
    parts,
    values,
    `trim(b.filtro_mensalista::text)`,
    collectMulti(url, F.mensalista).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.filtro_tem_contrato::text)`,
    collectMulti(url, F.temContrato).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.cidade_uf::text)`,
    collectMulti(url, F.cidadeUf).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.status_atividade::text)`,
    collectMulti(url, F.statusAtividade).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.categoria_cliente::text)`,
    collectMulti(url, F.categoria).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.tipo_documento_detectado::text)`,
    collectMulti(url, F.tipoDocumento).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.filtro_atuou_tomador::text)`,
    collectMulti(url, F.atuouTomador).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.filtro_atuou_remetente::text)`,
    collectMulti(url, F.atuouRemetente).map((v) => v.trim()).filter(Boolean),
  );
  appendEqOrAny(
    parts,
    values,
    `trim(b.filtro_atuou_destinatario::text)`,
    collectMulti(url, F.atuouDestinatario).map((v) => v.trim()).filter(Boolean),
  );

  return { sql: parts.join(" AND "), values };
}

export async function select360FacetOptions(
  pool: Pool,
  url: URL,
): Promise<{
  mensalistas: string[];
  temContrato: string[];
  cidades: string[];
  statusAtividades: string[];
  categorias: string[];
  tiposDocumento: string[];
  tomadores: string[];
  remetentes: string[];
  destinatarios: string[];
}> {
  const w = build360BaseWhere(url, { facetPeriodOnly: true });
  const q = (col: string) =>
    `SELECT DISTINCT trim(b.${col}::text) AS v FROM ${BI_COMERCIAL_360_CONFIG.baseView} b WHERE ${w.sql} AND trim(b.${col}::text) <> '' ORDER BY 1 LIMIT 300`;

  const [
    mRes,
    cRes,
    uRes,
    sRes,
    catRes,
    tdRes,
    tomRes,
    remRes,
    desRes,
  ] = await Promise.all([
    pool.query(q("filtro_mensalista"), w.values),
    pool.query(q("filtro_tem_contrato"), w.values),
    pool.query(q("cidade_uf"), w.values),
    pool.query(q("status_atividade"), w.values),
    pool.query(q("categoria_cliente"), w.values),
    pool.query(q("tipo_documento_detectado"), w.values),
    pool.query(q("filtro_atuou_tomador"), w.values),
    pool.query(q("filtro_atuou_remetente"), w.values),
    pool.query(q("filtro_atuou_destinatario"), w.values),
  ]);

  const mapV = (rows: { v: unknown }[]) =>
    (rows || []).map((x) => String(x.v ?? "").trim()).filter(Boolean);
  const sortU = (a: string[]) => [...new Set(a)].sort((x, y) => x.localeCompare(y, "pt-BR"));

  return {
    mensalistas: sortU(mapV((mRes.rows || []) as { v: unknown }[])),
    temContrato: sortU(mapV((cRes.rows || []) as { v: unknown }[])),
    cidades: sortU(mapV((uRes.rows || []) as { v: unknown }[])),
    statusAtividades: sortU(mapV((sRes.rows || []) as { v: unknown }[])),
    categorias: sortU(mapV((catRes.rows || []) as { v: unknown }[])),
    tiposDocumento: sortU(mapV((tdRes.rows || []) as { v: unknown }[])),
    tomadores: sortU(mapV((tomRes.rows || []) as { v: unknown }[])),
    remetentes: sortU(mapV((remRes.rows || []) as { v: unknown }[])),
    destinatarios: sortU(mapV((desRes.rows || []) as { v: unknown }[])),
  };
}

export async function select360Kpis(pool: Pool, url: URL): Promise<Record<string, unknown>> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      coalesce(sum(b.faturamento_real), 0)::numeric(15,2) AS faturamento_real,
      coalesce(sum(b.potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado,
      coalesce(sum(b.gap_estimado), 0::numeric)::numeric(15,2) AS gap_na_mesa,
      count(DISTINCT b.match_key)::bigint AS alvos_na_tela,
      count(DISTINCT b.match_key) FILTER (WHERE trim(b.status_atividade::text) = '[EM QUEDA]'::text)::bigint AS clientes_em_queda,
      count(DISTINCT b.match_key) FILTER (WHERE trim(b.status_atividade::text) = '[RISCO CHURN]'::text)::bigint AS risco_churn,
      coalesce(sum(b.dinheiro_em_risco), 0::numeric)::numeric(15,2) AS dinheiro_em_risco,
      coalesce(avg(b.ticket_medio_pagante), 0::numeric)::numeric(15,2) AS ticket_medio_alvo,
      CASE WHEN coalesce(sum(b.faturamento_real), 0::numeric) = 0::numeric THEN 0::numeric
           ELSE sum(b.faturamento_real) FILTER (WHERE trim(b.filtro_tem_contrato::text) = 'SIM'::text) / sum(b.faturamento_real) END AS receita_em_contratos_percentual
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
  `;
  const r = await pool.query(sql, w.values);
  return serializePgRow((r.rows?.[0] ?? {}) as Record<string, unknown>);
}

export async function select360Oportunidades(
  pool: Pool,
  url: URL,
  limit: number,
  offset: number,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const w = build360BaseWhere(url);
  const countSql = `
    SELECT count(*)::bigint AS c
    FROM ${BI_COMERCIAL_360_CONFIG.oportunidadesView} o
    INNER JOIN ${BI_COMERCIAL_360_CONFIG.baseView} b
      ON b.match_key = o.match_key AND b.data_referencia = o.data_referencia
    WHERE ${w.sql}
  `;
  const cRes = await pool.query(countSql, w.values);
  const total = Number((cRes.rows?.[0] as { c?: unknown })?.c ?? 0);

  const li = w.values.length + 1;
  const lo = w.values.length + 2;
  const sql = `
    SELECT o.*
    FROM ${BI_COMERCIAL_360_CONFIG.oportunidadesView} o
    INNER JOIN ${BI_COMERCIAL_360_CONFIG.baseView} b
      ON b.match_key = o.match_key AND b.data_referencia = o.data_referencia
    WHERE ${w.sql}
    ORDER BY o.score_oportunidade DESC NULLS LAST, o.faturamento_real DESC NULLS LAST
    LIMIT $${li}::int OFFSET $${lo}::int
  `;
  const r = await pool.query(sql, [...w.values, limit, offset]);
  const rows = (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, total };
}

export async function select360OportunidadesOrdered(
  pool: Pool,
  url: URL,
  order: "score" | "gap",
  limit: number,
): Promise<Record<string, unknown>[]> {
  const w = build360BaseWhere(url);
  const orderSql =
    order === "gap"
      ? "o.gap_estimado DESC NULLS LAST, o.score_oportunidade DESC NULLS LAST"
      : "o.score_oportunidade DESC NULLS LAST, o.gap_estimado DESC NULLS LAST";
  const sql = `
    SELECT o.*
    FROM ${BI_COMERCIAL_360_CONFIG.oportunidadesView} o
    INNER JOIN ${BI_COMERCIAL_360_CONFIG.baseView} b
      ON b.match_key = o.match_key AND b.data_referencia = o.data_referencia
    WHERE ${w.sql}
    ORDER BY ${orderSql}
    LIMIT $${w.values.length + 1}::int
  `;
  const r = await pool.query(sql, [...w.values, limit]);
  return (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
}

export async function select360DrillCliente(
  pool: Pool,
  url: URL,
  matchKey: string,
): Promise<Record<string, unknown>[]> {
  const { from, to } = resolve360Period(url);
  const values: unknown[] = [from, to, matchKey.trim()];
  const sql = `
    SELECT d.*
    FROM ${BI_COMERCIAL_360_CONFIG.drillView} d
    WHERE d.data_referencia >= $1::date AND d.data_referencia <= $2::date
      AND trim(d.match_key::text) = trim($3::text)
    ORDER BY d.data_referencia DESC
    LIMIT 200
  `;
  const r = await pool.query(sql, values);
  return (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
}

export async function select360EvolucaoMensal(
  pool: Pool,
  url: URL,
): Promise<
  Array<{
    data_referencia: string;
    ano: number;
    mes_num: number;
    mes_nome: string;
    faturamento_real: number;
    potencial_estimado: number;
    gap_estimado: number;
    qtd_clientes: number;
  }>
> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      b.data_referencia::text AS data_referencia,
      EXTRACT(year FROM b.data_referencia)::integer AS ano,
      EXTRACT(month FROM b.data_referencia)::integer AS mes_num,
      to_char(b.data_referencia::timestamp with time zone, 'TMMonth') AS mes_nome,
      coalesce(sum(b.faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real,
      coalesce(sum(b.potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado,
      coalesce(sum(b.gap_estimado), 0::numeric)::numeric(15,2) AS gap_estimado,
      count(DISTINCT b.match_key)::bigint AS qtd_clientes
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY b.data_referencia
    ORDER BY b.data_referencia ASC
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    data_referencia: String(row.data_referencia ?? "").slice(0, 10),
    ano: Number(row.ano ?? 0),
    mes_num: Number(row.mes_num ?? 0),
    mes_nome: String(row.mes_nome ?? "").trim(),
    faturamento_real: Number(row.faturamento_real ?? 0),
    potencial_estimado: Number(row.potencial_estimado ?? 0),
    gap_estimado: Number(row.gap_estimado ?? 0),
    qtd_clientes: Number(row.qtd_clientes ?? 0),
  }));
}

export async function select360ResumoContrato(
  pool: Pool,
  url: URL,
): Promise<Array<{ filtro_tem_contrato: string; qtd_clientes: number; faturamento_real: number; potencial_estimado: number }>> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      trim(b.filtro_tem_contrato::text) AS filtro_tem_contrato,
      count(DISTINCT b.match_key)::bigint AS qtd_clientes,
      coalesce(sum(b.faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real,
      coalesce(sum(b.potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY trim(b.filtro_tem_contrato::text)
    ORDER BY 1
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    filtro_tem_contrato: String(row.filtro_tem_contrato ?? ""),
    qtd_clientes: Number(row.qtd_clientes ?? 0),
    faturamento_real: Number(row.faturamento_real ?? 0),
    potencial_estimado: Number(row.potencial_estimado ?? 0),
  }));
}

export async function select360ResumoDocumento(
  pool: Pool,
  url: URL,
): Promise<
  Array<{ tipo_documento_detectado: string; qtd_clientes: number; faturamento_real: number; potencial_estimado: number; ticket_medio_alvo: number }>
> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      trim(b.tipo_documento_detectado::text) AS tipo_documento_detectado,
      count(DISTINCT b.match_key)::bigint AS qtd_clientes,
      coalesce(sum(b.faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real,
      coalesce(sum(b.potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado,
      coalesce(avg(b.ticket_medio_pagante), 0::numeric)::numeric(15,2) AS ticket_medio_alvo
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY trim(b.tipo_documento_detectado::text)
    ORDER BY coalesce(sum(b.faturamento_real), 0) DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    tipo_documento_detectado: String(row.tipo_documento_detectado ?? ""),
    qtd_clientes: Number(row.qtd_clientes ?? 0),
    faturamento_real: Number(row.faturamento_real ?? 0),
    potencial_estimado: Number(row.potencial_estimado ?? 0),
    ticket_medio_alvo: Number(row.ticket_medio_alvo ?? 0),
  }));
}

export async function select360ResumoCategoria(
  pool: Pool,
  url: URL,
): Promise<
  Array<{
    categoria_cliente: string;
    qtd_clientes: number;
    faturamento_real: number;
    potencial_estimado: number;
    gap_estimado: number;
    total_movimentos_geral: number;
    ticket_medio_alvo: number;
  }>
> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      trim(b.categoria_cliente::text) AS categoria_cliente,
      count(DISTINCT b.match_key)::bigint AS qtd_clientes,
      coalesce(sum(b.faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real,
      coalesce(sum(b.potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado,
      coalesce(sum(b.gap_estimado), 0::numeric)::numeric(15,2) AS gap_estimado,
      coalesce(sum(b.total_movimentos_geral), 0::bigint)::bigint AS total_movimentos_geral,
      coalesce(avg(b.ticket_medio_pagante), 0::numeric)::numeric(15,2) AS ticket_medio_alvo
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY trim(b.categoria_cliente::text)
    ORDER BY coalesce(sum(b.gap_estimado), 0) DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    categoria_cliente: String(row.categoria_cliente ?? ""),
    qtd_clientes: Number(row.qtd_clientes ?? 0),
    faturamento_real: Number(row.faturamento_real ?? 0),
    potencial_estimado: Number(row.potencial_estimado ?? 0),
    gap_estimado: Number(row.gap_estimado ?? 0),
    total_movimentos_geral: Number(row.total_movimentos_geral ?? 0),
    ticket_medio_alvo: Number(row.ticket_medio_alvo ?? 0),
  }));
}

export async function select360ResumoStatus(
  pool: Pool,
  url: URL,
): Promise<
  Array<{ status_atividade: string; qtd_clientes: number; faturamento_real: number; dinheiro_em_risco: number; gap_estimado: number }>
> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      trim(b.status_atividade::text) AS status_atividade,
      count(DISTINCT b.match_key)::bigint AS qtd_clientes,
      coalesce(sum(b.faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real,
      coalesce(sum(b.dinheiro_em_risco), 0::numeric)::numeric(15,2) AS dinheiro_em_risco,
      coalesce(sum(b.gap_estimado), 0::numeric)::numeric(15,2) AS gap_estimado
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
    GROUP BY trim(b.status_atividade::text)
    ORDER BY coalesce(sum(b.dinheiro_em_risco), 0) DESC NULLS LAST
  `;
  const r = await pool.query(sql, w.values);
  return (r.rows || []).map((row: Record<string, unknown>) => ({
    status_atividade: String(row.status_atividade ?? ""),
    qtd_clientes: Number(row.qtd_clientes ?? 0),
    faturamento_real: Number(row.faturamento_real ?? 0),
    dinheiro_em_risco: Number(row.dinheiro_em_risco ?? 0),
    gap_estimado: Number(row.gap_estimado ?? 0),
  }));
}

export async function select360Tabela(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; meta: { limit: number; offset: number; total: number } }> {
  const w = build360BaseWhere(url);
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") || BI_COMERCIAL_360_CONFIG.tableDefaultLimit) || 1),
    BI_COMERCIAL_360_CONFIG.tableMaxLimit,
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

  const countSql = `
    SELECT count(*)::bigint AS c
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
  `;
  const cRes = await pool.query(countSql, w.values);
  const total = Number((cRes.rows?.[0] as { c?: unknown })?.c ?? 0);

  const li = w.values.length + 1;
  const lo = w.values.length + 2;
  const sql = `
    SELECT
      b.prioridade_status::integer AS prioridade_status,
      trim(b.razao_social::text) AS razao_social,
      trim(b.nome_fantasia::text) AS nome_fantasia,
      trim(b.cidade_uf::text) AS cidade_uf,
      trim(b.status_atividade::text) AS status_atividade,
      trim(b.categoria_cliente::text) AS categoria_cliente,
      trim(b.filtro_tem_contrato::text) AS filtro_tem_contrato,
      trim(b.filtro_mensalista::text) AS filtro_mensalista,
      trim(b.tipo_documento_detectado::text) AS tipo_documento_detectado,
      b.faturamento_real::numeric(15,2) AS faturamento_real,
      b.potencial_estimado::numeric(15,2) AS potencial_estimado,
      b.gap_estimado::numeric(15,2) AS gap_estimado,
      b.dinheiro_em_risco::numeric(15,2) AS dinheiro_em_risco,
      b.ticket_medio_pagante::numeric(15,2) AS ticket_medio_pagante,
      b.total_movimentos_geral::bigint AS total_movimentos_geral,
      b.recencia_dias::integer AS recencia_dias,
      trim(b.match_key::text) AS match_key
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
    ORDER BY b.prioridade_status ASC, b.gap_estimado DESC NULLS LAST, b.faturamento_real DESC NULLS LAST
    LIMIT $${li}::int OFFSET $${lo}::int
  `;
  const r = await pool.query(sql, [...w.values, limit, offset]);
  const rows = (r.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, meta: { limit, offset, total } };
}

/** Cartões do radar: segmentos sobre a base já filtrada. */
export async function select360RadarSnapshot(pool: Pool, url: URL): Promise<{
  clientes_cif: number;
  faturamento_cif: number;
  sem_contrato_com_fat_clientes: number;
  sem_contrato_com_fat_faturamento: number;
  inativos_com_potencial_clientes: number;
  inativos_com_potencial_potencial: number;
}> {
  const w = build360BaseWhere(url);
  const sql = `
    SELECT
      count(DISTINCT b.match_key) FILTER (WHERE trim(b.flag_potencial_cif::text) = 'SIM'::text)::bigint AS clientes_cif,
      coalesce(sum(b.faturamento_real) FILTER (WHERE trim(b.flag_potencial_cif::text) = 'SIM'::text), 0::numeric)::numeric(15,2) AS faturamento_cif,
      count(DISTINCT b.match_key) FILTER (
        WHERE trim(b.filtro_tem_contrato::text) = 'NAO'::text AND coalesce(b.faturamento_real, 0::numeric) > 0::numeric
      )::bigint AS sem_contrato_com_fat_clientes,
      coalesce(sum(b.faturamento_real) FILTER (
        WHERE trim(b.filtro_tem_contrato::text) = 'NAO'::text AND coalesce(b.faturamento_real, 0::numeric) > 0::numeric
      ), 0::numeric)::numeric(15,2) AS sem_contrato_com_fat_faturamento,
      count(DISTINCT b.match_key) FILTER (
        WHERE trim(b.status_atividade::text) = '[INATIVO]'::text AND coalesce(b.potencial_estimado, 0::numeric) > 0::numeric
      )::bigint AS inativos_com_potencial_clientes,
      coalesce(sum(b.potencial_estimado) FILTER (
        WHERE trim(b.status_atividade::text) = '[INATIVO]'::text AND coalesce(b.potencial_estimado, 0::numeric) > 0::numeric
      ), 0::numeric)::numeric(15,2) AS inativos_com_potencial_potencial
    FROM ${BI_COMERCIAL_360_CONFIG.baseView} b
    WHERE ${w.sql}
  `;
  const r = await pool.query(sql, w.values);
  const row = (r.rows?.[0] ?? {}) as Record<string, unknown>;
  return {
    clientes_cif: Number(row.clientes_cif ?? 0),
    faturamento_cif: Number(row.faturamento_cif ?? 0),
    sem_contrato_com_fat_clientes: Number(row.sem_contrato_com_fat_clientes ?? 0),
    sem_contrato_com_fat_faturamento: Number(row.sem_contrato_com_fat_faturamento ?? 0),
    inativos_com_potencial_clientes: Number(row.inativos_com_potencial_clientes ?? 0),
    inativos_com_potencial_potencial: Number(row.inativos_com_potencial_potencial ?? 0),
  };
}
