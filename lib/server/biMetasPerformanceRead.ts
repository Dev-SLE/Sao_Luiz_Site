/**
 * BI Metas & Performance — leitura no Neon (COMERCIAL_DATABASE_URL, schema `bi`).
 * Meta do mês = mês cheio de `date_to`; realizado e LY pelo intervalo; projeção smart e dias úteis conforme fase_4.
 */
import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { BI_METAS_PERFORMANCE_CONFIG } from "@/modules/bi/metasPerformance/config";

const RESERVED = new Set(["from", "to", "limit", "offset", "refresh", "search"]);
const AG_KEY = BI_METAS_PERFORMANCE_CONFIG.filters.agencia;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolveMetasPeriodIso(url: URL): { from: string; to: string } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    to: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

export function collectMetasAgenciaFilters(url: URL): string[] {
  const out: string[] = [];
  for (const [key, val] of url.searchParams.entries()) {
    if (RESERVED.has(key.toLowerCase())) continue;
    if (key !== AG_KEY) continue;
    if (val === "") continue;
    const norm = val.trim().toUpperCase();
    if (norm && !out.includes(norm)) out.push(norm);
  }
  return out;
}

/** mes_ref = primeiro dia do mês de `to` (YYYY-MM-DD). */
export function mesReferenciaFromTo(toIso: string): string {
  return `${toIso.slice(0, 7)}-01`;
}

const DETAIL_SQL = `
WITH params AS (
  SELECT
    $1::date AS d_from,
    $2::date AS d_to,
    date_trunc('month', $2::date)::date AS mes_ref,
    LEAST($2::date, (CURRENT_DATE - INTERVAL '1 day')::date) AS corte
),
cal AS (
  SELECT
    (SELECT COUNT(*)::int
     FROM bi.dim_calendario c
     CROSS JOIN params p
     WHERE c.data >= p.d_from AND c.data <= p.corte AND c.eh_dia_util IS TRUE) AS dias_uteis_passados,
    (SELECT COUNT(*)::int
     FROM bi.dim_calendario c
     CROSS JOIN params p
     WHERE c.data >= p.mes_ref AND c.data < p.mes_ref + INTERVAL '1 month' AND c.eh_dia_util IS TRUE) AS dias_uteis_mes,
    (SELECT COUNT(*)::int
     FROM bi.dim_calendario c
     CROSS JOIN params p
     WHERE c.data > p.corte AND c.data < p.mes_ref + INTERVAL '1 month'
       AND c.data >= p.mes_ref AND c.eh_dia_util IS TRUE) AS dias_restantes
  FROM params p
),
agens AS (
  SELECT x.agencia_normalizada, MAX(x.agencia_label) AS agencia
  FROM (
    SELECT m.agencia_normalizada, MAX(m.agencia) AS agencia_label
    FROM bi.vw_metas_performance_agencia_mes m
    CROSS JOIN params p
    WHERE m.mes_referencia = p.mes_ref
      AND ($3::text[] IS NULL OR m.agencia_normalizada = ANY($3::text[]))
    GROUP BY m.agencia_normalizada
    UNION ALL
    SELECT b.agencia_normalizada, MAX(b.agencia) AS agencia_label
    FROM bi.vw_metas_performance_base b
    CROSS JOIN params p
    WHERE b.data_referencia >= p.d_from AND b.data_referencia <= p.d_to
      AND ($3::text[] IS NULL OR b.agencia_normalizada = ANY($3::text[]))
      AND NOT EXISTS (
        SELECT 1
        FROM bi.vw_metas_performance_agencia_mes m2
        CROSS JOIN params p2
        WHERE m2.mes_referencia = p2.mes_ref
          AND m2.agencia_normalizada = b.agencia_normalizada
      )
    GROUP BY b.agencia_normalizada
  ) x
  GROUP BY x.agencia_normalizada
),
real AS (
  SELECT b.agencia_normalizada, COALESCE(SUM(b.valor_total), 0)::numeric(15,2) AS realizado
  FROM bi.vw_metas_performance_base b
  CROSS JOIN params p
  WHERE b.data_referencia >= p.d_from AND b.data_referencia <= p.d_to
    AND ($3::text[] IS NULL OR b.agencia_normalizada = ANY($3::text[]))
  GROUP BY b.agencia_normalizada
),
ly AS (
  SELECT b.agencia_normalizada, COALESCE(SUM(b.valor_total), 0)::numeric(15,2) AS realizado_ly
  FROM bi.vw_metas_performance_base b
  CROSS JOIN params p
  WHERE b.data_referencia >= (p.d_from - INTERVAL '1 year')::date
    AND b.data_referencia <= (p.d_to - INTERVAL '1 year')::date
    AND ($3::text[] IS NULL OR b.agencia_normalizada = ANY($3::text[]))
  GROUP BY b.agencia_normalizada
),
meta AS (
  SELECT m.agencia_normalizada, COALESCE(MAX(m.meta_final), 0)::numeric(15,2) AS meta_mes
  FROM bi.vw_metas_performance_agencia_mes m
  CROSS JOIN params p
  WHERE m.mes_referencia = p.mes_ref
    AND ($3::text[] IS NULL OR m.agencia_normalizada = ANY($3::text[]))
  GROUP BY m.agencia_normalizada
),
joined AS (
  SELECT
    a.agencia_normalizada,
    a.agencia,
    COALESCE(mt.meta_mes, 0)::numeric(15,2) AS meta_mes,
    COALESCE(r.realizado, 0)::numeric(15,2) AS realizado,
    COALESCE(ly.realizado_ly, 0)::numeric(15,2) AS realizado_ly,
    cal.dias_uteis_passados::numeric AS dias_uteis_passados,
    cal.dias_uteis_mes::numeric AS dias_uteis_mes,
    cal.dias_restantes::numeric AS dias_restantes,
    p.mes_ref,
    p.corte,
    p.d_from,
    p.d_to
  FROM agens a
  CROSS JOIN cal
  CROSS JOIN params p
  LEFT JOIN meta mt ON mt.agencia_normalizada = a.agencia_normalizada
  LEFT JOIN real r ON r.agencia_normalizada = a.agencia_normalizada
  LEFT JOIN ly ly ON ly.agencia_normalizada = a.agencia_normalizada
),
proj AS (
  SELECT
    j.*,
    CASE
      WHEN j.dias_uteis_passados <= 0::numeric THEN j.realizado
      ELSE (
        j.realizado + (
          CASE
            WHEN (j.realizado / NULLIF(j.dias_uteis_passados, 0)) >
                 ((j.meta_mes / NULLIF(j.dias_uteis_mes, 0)) * 1.5)
            THEN (j.meta_mes / NULLIF(j.dias_uteis_mes, 0)) * 1.2
            ELSE (j.realizado / NULLIF(j.dias_uteis_passados, 0))
          END
        ) * j.dias_restantes
      )
    END::numeric(15,2) AS projecao_smart
  FROM joined j
)
SELECT
  agencia,
  agencia_normalizada,
  meta_mes,
  realizado,
  realizado_ly,
  projecao_smart,
  CASE WHEN meta_mes = 0::numeric THEN 0::numeric
       ELSE (projecao_smart / NULLIF(meta_mes, 0::numeric)) END AS pct_projetado,
  CASE WHEN realizado_ly = 0::numeric THEN NULL::numeric
       ELSE ((realizado - realizado_ly) / NULLIF(realizado_ly, 0::numeric)) END AS pct_crescimento,
  CASE WHEN dias_uteis_mes <= 0::numeric THEN 0::numeric
       ELSE (meta_mes / NULLIF(dias_uteis_mes, 0::numeric)) END AS meta_diaria,
  dias_uteis_passados::int,
  dias_uteis_mes::int,
  dias_restantes::int,
  mes_ref,
  corte,
  d_from,
  d_to
FROM proj
ORDER BY agencia ASC
`;

const CAL_ONLY_SQL = `
WITH params AS (
  SELECT
    $1::date AS d_from,
    $2::date AS d_to,
    date_trunc('month', $2::date)::date AS mes_ref,
    LEAST($2::date, (CURRENT_DATE - INTERVAL '1 day')::date) AS corte
),
cal AS (
  SELECT
    (SELECT COUNT(*)::int
     FROM bi.dim_calendario c
     CROSS JOIN params p
     WHERE c.data >= p.d_from AND c.data <= p.corte AND c.eh_dia_util IS TRUE) AS dias_uteis_passados,
    (SELECT COUNT(*)::int
     FROM bi.dim_calendario c
     CROSS JOIN params p
     WHERE c.data >= p.mes_ref AND c.data < p.mes_ref + INTERVAL '1 month' AND c.eh_dia_util IS TRUE) AS dias_uteis_mes,
    (SELECT COUNT(*)::int
     FROM bi.dim_calendario c
     CROSS JOIN params p
     WHERE c.data > p.corte AND c.data < p.mes_ref + INTERVAL '1 month'
       AND c.data >= p.mes_ref AND c.eh_dia_util IS TRUE) AS dias_restantes
  FROM params p
)
SELECT cal.*, p.mes_ref, p.corte, p.d_from, p.d_to
FROM cal
CROSS JOIN params p
`;

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export type MetasQueryMeta = {
  from: string;
  to: string;
  mesReferencia: string;
  corte: string | null;
  diasUteisPassados: number;
  diasUteisMes: number;
  diasRestantes: number;
};

function metaFromRows(rows: Record<string, unknown>[]): MetasQueryMeta {
  const r0 = rows[0];
  if (!r0) {
    return {
      from: "",
      to: "",
      mesReferencia: "",
      corte: null,
      diasUteisPassados: 0,
      diasUteisMes: 0,
      diasRestantes: 0,
    };
  }
  return {
    from: String(r0.d_from ?? "").slice(0, 10),
    to: String(r0.d_to ?? "").slice(0, 10),
    mesReferencia: String(r0.mes_ref ?? "").slice(0, 10),
    corte: r0.corte != null ? String(r0.corte).slice(0, 10) : null,
    diasUteisPassados: Math.round(toNum(r0.dias_uteis_passados)),
    diasUteisMes: Math.round(toNum(r0.dias_uteis_mes)),
    diasRestantes: Math.round(toNum(r0.dias_restantes)),
  };
}

export function buildMetasKpisFromDetailRows(rows: Record<string, unknown>[]): Record<string, unknown> {
  let sumMeta = 0;
  let sumReal = 0;
  let sumProj = 0;
  for (const r of rows) {
    sumMeta += toNum(r.meta_mes);
    sumReal += toNum(r.realizado);
    sumProj += toNum(r.projecao_smart);
  }
  const falta = Math.max(0, sumMeta - sumReal);
  const pctAting = sumMeta <= 0 ? 0 : sumProj / sumMeta;
  return {
    meta_oficial: sumMeta,
    ja_vendido: sumReal,
    previsao_fechamento: sumProj,
    falta_vender: falta,
    pct_atingimento_proj: pctAting,
  };
}

export async function selectMetasPerformanceDetail(pool: Pool, url: URL): Promise<{
  rows: Record<string, unknown>[];
  meta: MetasQueryMeta;
}> {
  const { from, to } = resolveMetasPeriodIso(url);
  const ags = collectMetasAgenciaFilters(url);
  const v3 = ags.length ? ags : null;
  const { rows: raw } = await pool.query(DETAIL_SQL, [from, to, v3]);
  const rows = raw.map((r) => serializePgRow(r as Record<string, unknown>));

  if (rows.length === 0) {
    const { rows: calRows } = await pool.query(CAL_ONLY_SQL, [from, to]);
    const cal0 = calRows[0] as Record<string, unknown> | undefined;
    const meta: MetasQueryMeta = cal0
      ? {
          from: String(cal0.d_from ?? "").slice(0, 10),
          to: String(cal0.d_to ?? "").slice(0, 10),
          mesReferencia: String(cal0.mes_ref ?? "").slice(0, 10),
          corte: cal0.corte != null ? String(cal0.corte).slice(0, 10) : null,
          diasUteisPassados: Math.round(toNum(cal0.dias_uteis_passados)),
          diasUteisMes: Math.round(toNum(cal0.dias_uteis_mes)),
          diasRestantes: Math.round(toNum(cal0.dias_restantes)),
        }
      : metaFromRows([]);
    return { rows: [], meta };
  }

  return { rows, meta: metaFromRows(rows) };
}

export async function selectMetasPerformanceKpis(pool: Pool, url: URL): Promise<{
  rows: Record<string, unknown>[];
  meta: MetasQueryMeta;
}> {
  const { rows, meta } = await selectMetasPerformanceDetail(pool, url);
  const kpi = buildMetasKpisFromDetailRows(rows);
  return { rows: [serializePgRow(kpi)], meta };
}

export async function selectMetasPerformanceRanking(pool: Pool, url: URL): Promise<Record<string, unknown>[]> {
  const { rows } = await selectMetasPerformanceDetail(pool, url);
  const sorted = [...rows].sort((a, b) => {
    const ra = toNum(a.realizado) / Math.max(toNum(a.meta_mes), 1e-9);
    const rb = toNum(b.realizado) / Math.max(toNum(b.meta_mes), 1e-9);
    return rb - ra;
  });
  return sorted;
}

export type MetasFacetOptions = {
  keys: { agencia: string };
  agencias: { label: string; value: string }[];
};

export async function selectMetasFacetOptions(pool: Pool, url: URL): Promise<MetasFacetOptions> {
  const { to } = resolveMetasPeriodIso(url);
  const mesRef = mesReferenciaFromTo(to);
  const { rows } = await pool.query(
    `SELECT DISTINCT TRIM(agencia) AS agencia, agencia_normalizada
     FROM bi.vw_metas_performance_agencia_mes
     WHERE mes_referencia = $1::date
     ORDER BY 1 ASC`,
    [mesRef],
  );
  const agencias = rows.map((r) => ({
    label: String(r.agencia ?? "").trim(),
    value: String(r.agencia_normalizada ?? "").trim(),
  })).filter((x) => x.value.length > 0);
  return { keys: { agencia: AG_KEY }, agencias };
}
