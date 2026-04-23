import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { defaultRotasOperacionaisRange, ROTAS_FAIXAS_PESO } from "@/modules/bi/rotasOperacionais/config";
import type {
  RotasDrillSummary,
  RotasHierarquiaNode,
  RotasOperacionaisDataset,
  RotasOperacionaisDrill,
  RotasOperacionaisFacets,
  RotasOperacionaisKpis,
} from "@/modules/bi/rotasOperacionais/types";

export type {
  RotasOperacionaisDataset,
  RotasOperacionaisDrill,
  RotasOperacionaisFacets,
} from "@/modules/bi/rotasOperacionais/types";

/** Mesma expressão de faixa que `view_bi_tela2_rotas` / documentação `docs/shema_bi.md`. */
const FAIXA_PESO_CASE = `CASE
  WHEN COALESCE(n.peso, 0::numeric) <= 10::numeric THEN '1. Até 10 kg'::text
  WHEN COALESCE(n.peso, 0::numeric) <= 30::numeric THEN '2. 11 a 30 kg'::text
  WHEN COALESCE(n.peso, 0::numeric) <= 50::numeric THEN '3. 31 a 50 kg'::text
  WHEN COALESCE(n.peso, 0::numeric) <= 100::numeric THEN '4. 51 a 100 kg'::text
  ELSE '5. Acima de 100 kg'::text
END`;

const NF_ROTAS_LINE = `
  n.id_unico AS id_unico,
  n.data_emissao::date AS data_referencia,
  trim(COALESCE(n.coleta, '')) AS agencia_origem,
  trim(COALESCE(n.destino, '')) AS cidade_destino,
  trim(COALESCE(n.rota, '')) AS rota,
  COALESCE(n.volumes, 0)::bigint AS volumes,
  COALESCE(n.peso, 0)::numeric AS peso,
  COALESCE(n.valor_total, 0)::numeric AS valor_total,
  (${FAIXA_PESO_CASE}) AS faixa_peso
`;

/** Filtro período + facetas ($1..$6) sobre `tb_nf_saidas_consolidada` n. Agência = origem (`coleta`). */
const NF_ROTAS_SCOPE_WHERE = `
  n.status_sistema = 'AUTORIZADA'::text
  AND n.data_emissao IS NOT NULL
  AND n.data_emissao::date >= $1::date
  AND n.data_emissao::date <= $2::date
  AND (cardinality($3::text[]) = 0 OR trim(COALESCE(n.coleta, '')) = ANY($3))
  AND (cardinality($4::text[]) = 0 OR trim(COALESCE(n.destino, '')) = ANY($4))
  AND (cardinality($5::text[]) = 0 OR (${FAIXA_PESO_CASE}) = ANY($5))
  AND (cardinality($6::text[]) = 0 OR trim(COALESCE(n.rota, '')) = ANY($6))
`;

const CTE_F_ROTAS = `
  f AS (
    SELECT ${NF_ROTAS_LINE}
    FROM tb_nf_saidas_consolidada n
    WHERE ${NF_ROTAS_SCOPE_WHERE}
  )
`;

function collectMulti(url: URL, key: string): string[] {
  const out: string[] = [];
  for (const v of url.searchParams.getAll(key)) {
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function parseIsoDate(s: string | null, fallback: string): string {
  const t = (s ?? fallback).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return fallback;
  return t;
}

type RotasScopedParams = {
  from: string;
  to: string;
  agencias: string[];
  cidadesDestino: string[];
  faixasPeso: string[];
  rotas: string[];
};

function parseRotasScopedParams(url: URL): RotasScopedParams {
  const d = defaultRotasOperacionaisRange();
  let from = parseIsoDate(url.searchParams.get("from"), d.from);
  let to = parseIsoDate(url.searchParams.get("to"), d.to);
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }
  return {
    from,
    to,
    agencias: collectMulti(url, "agencia"),
    cidadesDestino: collectMulti(url, "cidade_destino"),
    faixasPeso: collectMulti(url, "faixa_peso"),
    rotas: collectMulti(url, "rota"),
  };
}

function pushRotasScopeValues(values: unknown[], p: RotasScopedParams): void {
  values.push(p.from, p.to, p.agencias, p.cidadesDestino, p.faixasPeso, p.rotas);
}

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseKpisRow(o: Record<string, unknown>): RotasOperacionaisKpis {
  const total_ctes = num(o.total_ctes);
  const peso_total = num(o.peso_total);
  const volumes_total = num(o.volumes_total);
  const faturamento_total = num(o.faturamento_total);
  return {
    faturamento_total,
    ticket_medio: total_ctes > 0 ? faturamento_total / total_ctes : 0,
    total_ctes,
    peso_total,
    volumes_total,
    peso_medio_por_cte: total_ctes > 0 ? peso_total / total_ctes : 0,
    volumes_por_cte: total_ctes > 0 ? volumes_total / total_ctes : 0,
    faturamento_por_kg: peso_total > 0 ? faturamento_total / peso_total : 0,
  };
}

export async function selectRotasOperacionaisFacetOptions(pool: Pool, url: URL): Promise<RotasOperacionaisFacets> {
  const p = parseRotasScopedParams(url);
  const values: unknown[] = [];
  pushRotasScopeValues(values, p);
  const [ag, cd, ro] = await Promise.all([
    pool.query<{ a: string }>(`
      WITH ${CTE_F_ROTAS}
      SELECT DISTINCT trim(COALESCE(f.agencia_origem, '')) AS a
      FROM f
      WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
      ORDER BY 1
    `, values),
    pool.query<{ c: string }>(`
      WITH ${CTE_F_ROTAS}
      SELECT DISTINCT trim(COALESCE(f.cidade_destino, '')) AS c
      FROM f
      WHERE trim(COALESCE(f.cidade_destino, '')) <> ''
      ORDER BY 1
    `, values),
    pool.query<{ r: string }>(`
      WITH ${CTE_F_ROTAS}
      SELECT DISTINCT trim(COALESCE(f.rota, '')) AS r
      FROM f
      WHERE trim(COALESCE(f.rota, '')) <> ''
      ORDER BY 1
    `, values),
  ]);
  return {
    agencias: ag.rows.map((x) => x.a).filter(Boolean),
    cidadesDestino: cd.rows.map((x) => x.c).filter(Boolean),
    rotas: ro.rows.map((x) => x.r).filter(Boolean),
    faixasPeso: [...ROTAS_FAIXAS_PESO],
  };
}

function buildHierarchy(
  r1: Array<Record<string, unknown>>,
  r2: Array<Record<string, unknown>>,
  r3: Array<Record<string, unknown>>,
): RotasHierarquiaNode[] {
  const nodes: RotasHierarquiaNode[] = [];
  const id1 = (ag: string) => JSON.stringify({ l: 1, ag });
  const id2 = (ag: string, cd: string) => JSON.stringify({ l: 2, ag, cd });
  const id3 = (ag: string, cd: string, ro: string) => JSON.stringify({ l: 3, ag, cd, ro });

  for (const row of r1) {
    const ag = String(row.agencia_origem ?? "");
    if (!ag) continue;
    nodes.push({
      id: id1(ag),
      parentId: null,
      nivel: 1,
      agencia_origem: ag,
      cidade_destino: null,
      rota: null,
      faturamento_total: num(row.faturamento_total),
      peso_total: num(row.peso_total),
      ticket_medio: num(row.ticket_medio),
      total_ctes: num(row.total_ctes),
      volumes_total: num(row.volumes_total),
      faixa_peso: null,
    });
  }
  for (const row of r2) {
    const ag = String(row.agencia_origem ?? "");
    const cd = String(row.cidade_destino ?? "");
    if (!ag || !cd) continue;
    nodes.push({
      id: id2(ag, cd),
      parentId: id1(ag),
      nivel: 2,
      agencia_origem: ag,
      cidade_destino: cd,
      rota: null,
      faturamento_total: num(row.faturamento_total),
      peso_total: num(row.peso_total),
      ticket_medio: num(row.ticket_medio),
      total_ctes: num(row.total_ctes),
      volumes_total: num(row.volumes_total),
      faixa_peso: null,
    });
  }
  for (const row of r3) {
    const ag = String(row.agencia_origem ?? "");
    const cd = String(row.cidade_destino ?? "");
    const ro = String(row.rota ?? "");
    if (!ag || !cd || !ro) continue;
    const fp = row.faixa_peso != null && String(row.faixa_peso).trim() !== "" ? String(row.faixa_peso) : null;
    nodes.push({
      id: id3(ag, cd, ro),
      parentId: id2(ag, cd),
      nivel: 3,
      agencia_origem: ag,
      cidade_destino: cd,
      rota: ro,
      faturamento_total: num(row.faturamento_total),
      peso_total: num(row.peso_total),
      ticket_medio: num(row.ticket_medio),
      total_ctes: num(row.total_ctes),
      volumes_total: num(row.volumes_total),
      faixa_peso: fp,
    });
  }
  return nodes;
}

export async function selectRotasOperacionaisDataset(pool: Pool, url: URL): Promise<RotasOperacionaisDataset> {
  const p = parseRotasScopedParams(url);
  const values: unknown[] = [];
  pushRotasScopeValues(values, p);

  const sqlKpis = `
    WITH ${CTE_F_ROTAS}
    SELECT
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.volumes), 0)::bigint AS volumes_total,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total
    FROM f
  `;

  const sqlRankAg = `
    WITH ${CTE_F_ROTAS}
    SELECT
      trim(f.agencia_origem) AS agencia_origem,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.volumes), 0)::bigint AS volumes_total,
      CASE WHEN count(*) > 0 THEN COALESCE(sum(f.valor_total), 0::numeric) / count(*)::numeric ELSE 0::numeric END AS ticket_medio
    FROM f
    WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
    GROUP BY 1
    ORDER BY faturamento_total DESC NULLS LAST
    LIMIT 15
  `;

  const sqlRankCity = `
    WITH ${CTE_F_ROTAS}
    SELECT
      trim(f.cidade_destino) AS cidade_destino,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.volumes), 0)::bigint AS volumes_total
    FROM f
    WHERE trim(COALESCE(f.cidade_destino, '')) <> ''
    GROUP BY 1
    ORDER BY faturamento_total DESC NULLS LAST
    LIMIT 24
  `;

  const sqlRankRota = `
    WITH ${CTE_F_ROTAS}
    SELECT
      trim(f.rota) AS rota,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento,
      CASE WHEN count(*) > 0 THEN COALESCE(sum(f.valor_total), 0::numeric) / count(*)::numeric ELSE 0::numeric END AS ticket,
      COALESCE(sum(f.volumes), 0)::bigint AS volume,
      count(*)::bigint AS total_ctes
    FROM f
    WHERE trim(COALESCE(f.rota, '')) <> ''
    GROUP BY 1
    ORDER BY faturamento DESC NULLS LAST
    LIMIT 15
  `;

  const sqlFaixa = `
    WITH ${CTE_F_ROTAS}
    SELECT
      f.faixa_peso,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total
    FROM f
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const sqlH1 = `
    WITH ${CTE_F_ROTAS}
    SELECT
      trim(f.agencia_origem) AS agencia_origem,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.volumes), 0)::bigint AS volumes_total,
      CASE WHEN count(*) > 0 THEN COALESCE(sum(f.valor_total), 0::numeric) / count(*)::numeric ELSE 0::numeric END AS ticket_medio
    FROM f
    WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
    GROUP BY 1
    ORDER BY faturamento_total DESC NULLS LAST
    LIMIT 40
  `;

  const sqlH2 = `
    WITH ${CTE_F_ROTAS}
    SELECT
      trim(f.agencia_origem) AS agencia_origem,
      trim(f.cidade_destino) AS cidade_destino,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.volumes), 0)::bigint AS volumes_total,
      CASE WHEN count(*) > 0 THEN COALESCE(sum(f.valor_total), 0::numeric) / count(*)::numeric ELSE 0::numeric END AS ticket_medio
    FROM f
    WHERE trim(COALESCE(f.agencia_origem, '')) <> '' AND trim(COALESCE(f.cidade_destino, '')) <> ''
    GROUP BY 1, 2
    ORDER BY faturamento_total DESC NULLS LAST
    LIMIT 120
  `;

  /** Faixa predominante por (agência, cidade, rota) sem subquery correlacionada ao `GROUP BY` (PostgreSQL 42803). */
  const sqlH3 = `
    WITH ${CTE_F_ROTAS},
    h3_faixa_counts AS (
      SELECT
        trim(f.agencia_origem) AS agencia_origem,
        trim(f.cidade_destino) AS cidade_destino,
        trim(f.rota) AS rota,
        f.faixa_peso,
        count(*)::bigint AS c
      FROM f
      WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
        AND trim(COALESCE(f.cidade_destino, '')) <> ''
        AND trim(COALESCE(f.rota, '')) <> ''
      GROUP BY 1, 2, 3, 4
    ),
    h3_faixa_mode AS (
      SELECT agencia_origem, cidade_destino, rota, faixa_peso
      FROM (
        SELECT
          agencia_origem,
          cidade_destino,
          rota,
          faixa_peso,
          row_number() OVER (PARTITION BY agencia_origem, cidade_destino, rota ORDER BY c DESC) AS rn
        FROM h3_faixa_counts
      ) z
      WHERE rn = 1
    ),
    h3_agg AS (
      SELECT
        trim(f.agencia_origem) AS agencia_origem,
        trim(f.cidade_destino) AS cidade_destino,
        trim(f.rota) AS rota,
        count(*)::bigint AS total_ctes,
        COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
        COALESCE(sum(f.peso), 0)::numeric AS peso_total,
        COALESCE(sum(f.volumes), 0)::bigint AS volumes_total,
        CASE WHEN count(*) > 0 THEN COALESCE(sum(f.valor_total), 0::numeric) / count(*)::numeric ELSE 0::numeric END AS ticket_medio
      FROM f
      WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
        AND trim(COALESCE(f.cidade_destino, '')) <> ''
        AND trim(COALESCE(f.rota, '')) <> ''
      GROUP BY trim(f.agencia_origem), trim(f.cidade_destino), trim(f.rota)
    )
    SELECT
      a.agencia_origem,
      a.cidade_destino,
      a.rota,
      a.total_ctes,
      a.faturamento_total,
      a.peso_total,
      a.volumes_total,
      a.ticket_medio,
      m.faixa_peso
    FROM h3_agg a
    LEFT JOIN h3_faixa_mode m
      ON m.agencia_origem = a.agencia_origem
      AND m.cidade_destino = a.cidade_destino
      AND m.rota = a.rota
    ORDER BY a.faturamento_total DESC NULLS LAST
    LIMIT 400
  `;

  const [rK, rAg, rCity, rRota, rFx, rH1, rH2, rH3] = await Promise.all([
    pool.query(sqlKpis, values),
    pool.query(sqlRankAg, values),
    pool.query(sqlRankCity, values),
    pool.query(sqlRankRota, values),
    pool.query(sqlFaixa, values),
    pool.query(sqlH1, values),
    pool.query(sqlH2, values),
    pool.query(sqlH3, values),
  ]);

  const kpis = parseKpisRow((rK.rows[0] || {}) as Record<string, unknown>);

  const rankingAgencias = (rAg.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      agencia_origem: String(o.agencia_origem ?? ""),
      faturamento_total: num(o.faturamento_total),
      total_ctes: num(o.total_ctes),
    };
  });

  const rankingCidades = (rCity.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      cidade_destino: String(o.cidade_destino ?? ""),
      faturamento_total: num(o.faturamento_total),
      total_ctes: num(o.total_ctes),
      peso_total: num(o.peso_total),
      volumes_total: num(o.volumes_total),
    };
  });

  const rankingRotas = (rRota.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      rota: String(o.rota ?? ""),
      faturamento: num(o.faturamento),
      ticket: num(o.ticket),
      volume: num(o.volume),
      total_ctes: num(o.total_ctes),
    };
  });

  const faixaPeso = (rFx.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      faixa_peso: String(o.faixa_peso ?? ""),
      total_ctes: num(o.total_ctes),
      faturamento_total: num(o.faturamento_total),
      peso_total: num(o.peso_total),
    };
  });

  const hierarchy = buildHierarchy(
    (rH1.rows || []) as Record<string, unknown>[],
    (rH2.rows || []) as Record<string, unknown>[],
    (rH3.rows || []) as Record<string, unknown>[],
  );

  return {
    kpis,
    rankingAgencias,
    rankingCidades,
    mapaCidades: rankingCidades,
    rankingRotas,
    faixaPeso,
    hierarchy,
  };
}

function parseDrillSummary(o: Record<string, unknown>): RotasDrillSummary {
  const total_ctes = num(o.total_ctes);
  const peso_total = num(o.peso_total);
  const faturamento_total = num(o.faturamento_total);
  return {
    agencia_origem: String(o.agencia_origem ?? ""),
    cidade_destino: String(o.cidade_destino ?? ""),
    rota: String(o.rota ?? ""),
    faixa_peso_predominante: o.faixa_peso_predominante != null ? String(o.faixa_peso_predominante) : null,
    faturamento_total,
    peso_total,
    volumes_total: num(o.volumes_total),
    total_ctes,
    ticket_medio: total_ctes > 0 ? faturamento_total / total_ctes : 0,
    faturamento_por_kg: peso_total > 0 ? faturamento_total / peso_total : 0,
  };
}

export async function selectRotasOperacionaisDrill(pool: Pool, url: URL): Promise<RotasOperacionaisDrill> {
  const p = parseRotasScopedParams(url);
  const ag = (url.searchParams.get("agencia_origem") || url.searchParams.get("agencia") || "").trim();
  const cd = (url.searchParams.get("cidade_destino") || "").trim();
  const ro = (url.searchParams.get("rota") || "").trim();
  if (!ag || !cd || !ro) {
    return { summary: null, lines: [] };
  }

  const values: unknown[] = [];
  pushRotasScopeValues(values, p);
  values.push(ag, cd, ro);

  const sqlSummary = `
    WITH ${CTE_F_ROTAS},
    drill AS (SELECT * FROM f WHERE trim(f.agencia_origem) = trim($7::text) AND trim(f.cidade_destino) = trim($8::text) AND trim(f.rota) = trim($9::text))
    SELECT
      trim($7::text) AS agencia_origem,
      trim($8::text) AS cidade_destino,
      trim($9::text) AS rota,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(drill.volumes), 0)::bigint AS volumes_total,
      COALESCE(sum(drill.peso), 0)::numeric AS peso_total,
      COALESCE(sum(drill.valor_total), 0)::numeric AS faturamento_total,
      (
        SELECT d.faixa_peso FROM drill d
        GROUP BY d.faixa_peso
        ORDER BY count(*) DESC
        LIMIT 1
      ) AS faixa_peso_predominante
    FROM drill
  `;

  const sqlLines = `
    SELECT ${NF_ROTAS_LINE}
    FROM tb_nf_saidas_consolidada n
    WHERE ${NF_ROTAS_SCOPE_WHERE}
      AND trim(COALESCE(n.coleta, '')) = trim($7::text)
      AND trim(COALESCE(n.destino, '')) = trim($8::text)
      AND trim(COALESCE(n.rota, '')) = trim($9::text)
    ORDER BY n.data_emissao DESC NULLS LAST, n.id_unico ASC
    LIMIT 500
  `;

  const [rS, rL] = await Promise.all([pool.query(sqlSummary, values), pool.query(sqlLines, values)]);
  const summaryRow = rS.rows[0] as Record<string, unknown> | undefined;
  const summary = summaryRow && num(summaryRow.total_ctes) > 0 ? parseDrillSummary(summaryRow) : null;
  const lines = (rL.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));

  return { summary, lines };
}

const MAX_EXPORT_MOVIMENTOS = 80_000;

/** CTEs no período e facetas; opcionalmente só o triple do drill (`export_drill=1` + drill_*). */
export async function selectRotasOperacionaisExportMovimentos(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const p = parseRotasScopedParams(url);
  const values: unknown[] = [];
  pushRotasScopeValues(values, p);
  let extraWhere = "";
  const drillExport = url.searchParams.get("export_drill") === "1";
  const dag = (url.searchParams.get("drill_agencia") || "").trim();
  const dcd = (url.searchParams.get("drill_cidade") || "").trim();
  const dro = (url.searchParams.get("drill_rota") || "").trim();
  if (drillExport && dag && dcd && dro) {
    values.push(dag, dcd, dro);
    const iAg = values.length - 2;
    const iCd = values.length - 1;
    const iRo = values.length;
    extraWhere = `
      AND trim(COALESCE(n.coleta, '')) = trim($${iAg}::text)
      AND trim(COALESCE(n.destino, '')) = trim($${iCd}::text)
      AND trim(COALESCE(n.rota, '')) = trim($${iRo}::text)
    `;
  }

  const sql = `
    SELECT ${NF_ROTAS_LINE}
    FROM tb_nf_saidas_consolidada n
    WHERE ${NF_ROTAS_SCOPE_WHERE}
    ${extraWhere}
    ORDER BY n.data_emissao DESC NULLS LAST, n.id_unico ASC
    LIMIT ${MAX_EXPORT_MOVIMENTOS + 1}
  `;
  const r = await pool.query(sql, values);
  const truncated = r.rows.length > MAX_EXPORT_MOVIMENTOS;
  const slice = (r.rows || []).slice(0, MAX_EXPORT_MOVIMENTOS);
  const rows = slice.map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, truncated };
}
