/**
 * BI Campanhas & Incentivos — leitura no Neon (COMERCIAL_DATABASE_URL, schema `bi`).
 * Mês efetivo = primeiro dia do mês de `to` (ou `from`, ou hoje). Só vendedoras em `meta_campanha_vendedor` no mês.
 */
import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { BI_SPRINT_VENDAS_CONFIG } from "@/modules/bi/sprintVendas/config";

const RESERVED = new Set(["from", "to", "limit", "offset", "refresh", "search"]);
const VEND_KEY = BI_SPRINT_VENDAS_CONFIG.filters.vendedor;

/** Primeiro dia do mês de referência (YYYY-MM-DD) a partir de `to` > `from` > hoje. */
export function resolveMesReferenciaIso(url: URL): string {
  const to = url.searchParams.get("to");
  const from = url.searchParams.get("from");
  const pick =
    to && /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? to
      : from && /^\d{4}-\d{2}-\d{2}$/.test(from)
        ? from
        : new Date().toISOString().slice(0, 10);
  const y = Number(pick.slice(0, 4));
  const m = Number(pick.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function collectSprintVendedorFilters(url: URL): string[] {
  const out: string[] = [];
  for (const [key, val] of url.searchParams.entries()) {
    if (RESERVED.has(key.toLowerCase())) continue;
    if (key !== VEND_KEY) continue;
    if (val === "") continue;
    if (!out.includes(val)) out.push(val);
  }
  return out;
}

export type SprintQueryMeta = {
  mesReferencia: string;
  refLogica: string | null;
};

const KPI_SQL = `
WITH ref AS (
  SELECT
    $1::date AS mes_ref,
    CASE
      WHEN CURRENT_DATE < $1::date THEN $1::date
      WHEN CURRENT_DATE > ($1::date + INTERVAL '1 month - 1 day')::date
        THEN ($1::date + INTERVAL '1 month - 1 day')::date
      ELSE CURRENT_DATE::date
    END AS ref_logica
),
eligible AS (
  SELECT m.vendedor
  FROM bi.meta_campanha_vendedor m
  CROSS JOIN ref r
  WHERE m.data_referencia = r.mes_ref
    AND ($2::text[] IS NULL OR m.vendedor = ANY($2::text[]))
),
cal_mes AS (
  SELECT COALESCE(MAX(c.dias_uteis_mes), 0)::int AS dias_uteis_mes
  FROM bi.vw_calendario_semana_mes_robusta c
  CROSS JOIN ref r
  WHERE c.mes_referencia = r.mes_ref
),
mensal AS (
  SELECT vm.*
  FROM bi.vw_sprint_vendas_mensal vm
  INNER JOIN eligible e ON e.vendedor = vm.vendedor
  CROSS JOIN ref r
  WHERE vm.mes_referencia = r.mes_ref
),
agg AS (
  SELECT
    COALESCE(SUM(m.meta_mensal), 0)::numeric AS sum_meta,
    COALESCE(SUM(m.venda_auditada_mes), 0)::numeric AS sum_venda,
    COALESCE(SUM(m.premio_total), 0)::numeric AS sum_premio_tot,
    COALESCE(SUM(m.premios_ja_garantidos), 0)::numeric AS sum_premio_gar,
    COALESCE(MAX(m.dias_uteis_mes), cm.dias_uteis_mes, 0)::int AS dias_uteis_mes
  FROM cal_mes cm
  LEFT JOIN mensal m ON TRUE
  GROUP BY cm.dias_uteis_mes
),
rest_count AS (
  SELECT COUNT(DISTINCT c.data)::int AS dias_uteis_restantes
  FROM bi.vw_calendario_semana_mes_robusta c
  CROSS JOIN ref r
  WHERE c.mes_referencia = r.mes_ref
    AND c.data >= r.ref_logica
    AND c.eh_dia_util IS TRUE
),
meta_sem AS (
  SELECT COALESCE(SUM(s.meta_semanal_est), 0)::numeric AS meta_semana_alvo
  FROM bi.vw_sprint_vendas_semanal s
  INNER JOIN eligible e ON e.vendedor = s.vendedor
  CROSS JOIN ref r
  WHERE s.mes_referencia = r.mes_ref
    AND r.ref_logica BETWEEN s.inicio_semana_no_mes AND s.fim_semana_no_mes
)
SELECT
  r.mes_ref AS mes_referencia,
  r.ref_logica,
  rc.dias_uteis_restantes,
  a.sum_premio_tot AS premios_totais,
  a.sum_premio_gar AS premios_ja_garantidos,
  CASE WHEN a.sum_meta = 0 THEN 0::numeric ELSE a.sum_venda / a.sum_meta END AS percentual_conclusao_meta,
  COALESCE(a.sum_meta / NULLIF(a.dias_uteis_mes, 0)::numeric, 0::numeric) AS meta_diaria_padrao,
  COALESCE(
    GREATEST(
      (a.sum_meta - a.sum_venda) / NULLIF(rc.dias_uteis_restantes, 0)::numeric,
      0::numeric
    ),
    0::numeric
  ) AS alvo_diario_recuperacao,
  ms.meta_semana_alvo,
  (
    COALESCE(
      GREATEST(
        (a.sum_meta - a.sum_venda) / NULLIF(rc.dias_uteis_restantes, 0)::numeric,
        0::numeric
      ),
      0::numeric
    )
    - COALESCE(a.sum_meta / NULLIF(a.dias_uteis_mes, 0)::numeric, 0::numeric)
  ) AS gap_diario,
  a.sum_meta AS sum_meta_mensal,
  a.sum_venda AS sum_venda_auditada_mes
FROM ref r
CROSS JOIN agg a
CROSS JOIN rest_count rc
CROSS JOIN meta_sem ms
`;

export async function selectSprintKpis(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; meta: SprintQueryMeta }> {
  const mesRef = resolveMesReferenciaIso(url);
  const vends = collectSprintVendedorFilters(url);
  const vParam = vends.length ? vends : null;
  const { rows } = await pool.query(KPI_SQL, [mesRef, vParam]);
  const raw = rows[0] as Record<string, unknown> | undefined;
  const serialized = raw ? serializePgRow(raw) : null;
  const meta: SprintQueryMeta = {
    mesReferencia: mesRef,
    refLogica: serialized?.ref_logica != null ? String(serialized.ref_logica).slice(0, 10) : null,
  };
  return { rows: serialized ? [serialized] : [], meta };
}

const RANKING_SQL = `
WITH ref AS ( SELECT $1::date AS mes_ref ),
eligible AS (
  SELECT m.vendedor
  FROM bi.meta_campanha_vendedor m
  CROSS JOIN ref r
  WHERE m.data_referencia = r.mes_ref
    AND ($2::text[] IS NULL OR m.vendedor = ANY($2::text[]))
)
SELECT rk.mes_referencia, rk.vendedor, rk.meta_mensal, rk.venda_auditada_mes, rk.percentual_atingimento
FROM bi.vw_sprint_vendas_ranking rk
INNER JOIN eligible e ON e.vendedor = rk.vendedor
CROSS JOIN ref r
WHERE rk.mes_referencia = r.mes_ref
ORDER BY rk.percentual_atingimento DESC NULLS LAST, rk.vendedor ASC
`;

export async function selectSprintRanking(pool: Pool, url: URL): Promise<Record<string, unknown>[]> {
  const mesRef = resolveMesReferenciaIso(url);
  const vends = collectSprintVendedorFilters(url);
  const vParam = vends.length ? vends : null;
  const { rows } = await pool.query(RANKING_SQL, [mesRef, vParam]);
  return rows.map((r) => serializePgRow(r as Record<string, unknown>));
}

const TABLE_SQL = `
WITH ref AS ( SELECT $1::date AS mes_ref ),
eligible AS (
  SELECT m.vendedor
  FROM bi.meta_campanha_vendedor m
  CROSS JOIN ref r
  WHERE m.data_referencia = r.mes_ref
    AND ($2::text[] IS NULL OR m.vendedor = ANY($2::text[]))
)
SELECT
  t.mes_referencia,
  t.vendedor,
  t.semana_mes_ordem,
  t.semana_mes_label,
  t.meta_semanal_est,
  t.venda_auditada_semana,
  t.percentual_meta_semana,
  t.status_semana
FROM bi.vw_sprint_vendas_tabela t
INNER JOIN eligible e ON e.vendedor = t.vendedor
CROSS JOIN ref r
WHERE t.mes_referencia = r.mes_ref
ORDER BY t.vendedor ASC, t.semana_mes_ordem ASC NULLS LAST
`;

export async function selectSprintTabela(pool: Pool, url: URL): Promise<Record<string, unknown>[]> {
  const mesRef = resolveMesReferenciaIso(url);
  const vends = collectSprintVendedorFilters(url);
  const vParam = vends.length ? vends : null;
  const { rows } = await pool.query(TABLE_SQL, [mesRef, vParam]);
  return rows.map((r) => serializePgRow(r as Record<string, unknown>));
}

export type SprintFacetOptions = {
  keys: { vendedor: string };
  meses: string[];
  vendedores: string[];
};

export async function selectSprintFacetOptions(pool: Pool, url: URL): Promise<SprintFacetOptions> {
  const mesRef = resolveMesReferenciaIso(url);
  const mesesRes = await pool.query(
    `SELECT DISTINCT data_referencia::date AS mes
     FROM bi.meta_campanha_vendedor
     ORDER BY mes DESC
     LIMIT 36`,
  );
  const meses = mesesRes.rows.map((r) => {
    const d = r.mes as Date | string;
    const s = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
    return s.slice(0, 7) + "-01";
  });
  const uniqMeses = [...new Set(meses)];

  const vendRes = await pool.query(
    `SELECT DISTINCT TRIM(vendedor) AS vendedor
     FROM bi.meta_campanha_vendedor
     WHERE data_referencia = $1::date
       AND TRIM(COALESCE(vendedor, '')) <> ''
     ORDER BY 1 ASC`,
    [mesRef],
  );
  const vendedores = vendRes.rows.map((r) => String(r.vendedor ?? "").trim()).filter(Boolean);

  return {
    keys: { vendedor: VEND_KEY },
    meses: uniqMeses,
    vendedores,
  };
}
