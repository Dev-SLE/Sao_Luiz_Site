import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { defaultDesempenhoAgenciasRange } from "@/modules/bi/desempenhoAgencias/config";
import type {
  DesempenhoAgenciasDataset,
  DesempenhoAgenciasDrill,
  DesempenhoAgenciasFacets,
  DesempenhoAgenciasKpis,
  DesempenhoAgenciasTableRow,
} from "@/modules/bi/desempenhoAgencias/types";

export type {
  DesempenhoAgenciasDataset,
  DesempenhoAgenciasDrill,
  DesempenhoAgenciasFacets,
  DesempenhoAgenciasKpis,
  DesempenhoAgenciasTableRow,
} from "@/modules/bi/desempenhoAgencias/types";

/**
 * Grão oficial por CTE a partir da tabela (fase_8). Não depender das views `bi.*`:
 * em produção podem existir versões antigas com colunas diferentes (`qtd_volumes`, etc.).
 */
const NF_LINE_SELECT = `
  n.id_unico AS id_unico,
  n.data_emissao::date AS data_referencia,
  date_trunc('month', n.data_emissao::timestamp)::date AS mes_referencia,
  trim(COALESCE(n.coleta, '')) AS agencia_origem,
  trim(COALESCE(n.entrega, '')) AS agencia_destino,
  trim(COALESCE(n.rota, '')) AS rota,
  trim(COALESCE(n.tipo_frete, '')) AS tipo_frete,
  COALESCE(n.volumes, 0)::bigint AS volumes,
  COALESCE(n.peso, 0)::numeric AS peso,
  COALESCE(n.valor_total, 0)::numeric AS valor_total,
  CASE WHEN COALESCE(n.tx_coleta, 0::numeric) > 0::numeric THEN 1 ELSE 0 END::integer AS flg_coleta,
  CASE WHEN COALESCE(n.tx_entrega, 0::numeric) > 0::numeric THEN 1 ELSE 0 END::integer AS flg_entrega,
  CASE WHEN COALESCE(n.numero_mfde, 0::bigint) > 0::bigint THEN 1 ELSE 0 END::integer AS flg_manifesto
`;

/** Filtro período + facetas ($1..$5) sobre `tb_nf_saidas_consolidada` n. */
const NF_SCOPE_WHERE = `
  n.status_sistema = 'AUTORIZADA'::text
  AND n.data_emissao IS NOT NULL
  AND n.data_emissao::date >= $1::date
  AND n.data_emissao::date <= $2::date
  AND (cardinality($3::text[]) = 0 OR trim(COALESCE(n.coleta, '')) = ANY($3) OR trim(COALESCE(n.entrega, '')) = ANY($3))
  AND (cardinality($4::text[]) = 0 OR trim(COALESCE(n.rota, '')) = ANY($4))
  AND (cardinality($5::text[]) = 0 OR trim(COALESCE(n.tipo_frete, '')) = ANY($5))
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

type ScopedParams = {
  from: string;
  to: string;
  agencias: string[];
  rotas: string[];
  tipos: string[];
};

function parseScopedParams(url: URL): ScopedParams {
  const d = defaultDesempenhoAgenciasRange();
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
    rotas: collectMulti(url, "rota"),
    tipos: collectMulti(url, "tipo_frete"),
  };
}

/** $1 from $2 to $3 agencias $4 rotas $5 tipos — sempre 5 params (arrays vazios ok). */
function pushScopeValues(values: unknown[], p: ScopedParams): void {
  values.push(p.from, p.to, p.agencias, p.rotas, p.tipos);
}

const CTE_F = `
  f AS (
    SELECT ${NF_LINE_SELECT}
    FROM tb_nf_saidas_consolidada n
    WHERE ${NF_SCOPE_WHERE}
  )
`;

export async function selectDesempenhoAgenciasFacetOptions(pool: Pool, url: URL): Promise<DesempenhoAgenciasFacets> {
  const p = parseScopedParams(url);
  const values: unknown[] = [];
  pushScopeValues(values, p);
  const [ag, ro, tf] = await Promise.all([
    pool.query<{ a: string }>(`
      WITH ${CTE_F}
      SELECT DISTINCT trim(x) AS a
      FROM (
        SELECT trim(COALESCE(f.agencia_origem, '')) AS x FROM f
        UNION
        SELECT trim(COALESCE(f.agencia_destino, '')) AS x FROM f
      ) s
      WHERE trim(x) <> ''
      ORDER BY 1
    `, values),
    pool.query<{ r: string }>(`
      WITH ${CTE_F}
      SELECT DISTINCT trim(COALESCE(f.rota, '')) AS r
      FROM f
      WHERE trim(COALESCE(f.rota, '')) <> ''
      ORDER BY 1
    `, values),
    pool.query<{ t: string }>(`
      WITH ${CTE_F}
      SELECT DISTINCT trim(COALESCE(f.tipo_frete, '')) AS t
      FROM f
      WHERE trim(COALESCE(f.tipo_frete, '')) <> ''
      ORDER BY 1
    `, values),
  ]);
  return {
    agencias: ag.rows.map((x) => x.a).filter(Boolean),
    rotas: ro.rows.map((x) => x.r).filter(Boolean),
    tiposFrete: tf.rows.map((x) => x.t).filter(Boolean),
  };
}

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseKpisRow(o: Record<string, unknown>): DesempenhoAgenciasKpis {
  const total_ctes = num(o.total_ctes);
  const total_volumes = num(o.total_volumes);
  const fat = num(o.faturamento_total);
  return {
    total_ctes,
    total_volumes,
    qtd_coletas: num(o.qtd_coletas),
    qtd_entregas: num(o.qtd_entregas),
    peso_total: num(o.peso_total),
    faturamento_total: fat,
    volumes_por_cte: total_ctes > 0 ? total_volumes / total_ctes : 0,
    ticket_por_cte: total_ctes > 0 ? fat / total_ctes : 0,
    pct_coleta: total_ctes > 0 ? (num(o.qtd_coletas) / total_ctes) * 100 : 0,
    pct_entrega: total_ctes > 0 ? (num(o.qtd_entregas) / total_ctes) * 100 : 0,
    pct_manifesto: total_ctes > 0 ? (num(o.qtd_manifestos) / total_ctes) * 100 : 0,
  };
}

function parseTableRow(o: Record<string, unknown>): DesempenhoAgenciasTableRow {
  return {
    agencia: String(o.agencia ?? ""),
    total_ctes_origem: num(o.total_ctes_origem),
    total_ctes_destino: num(o.total_ctes_destino),
    total_volumes_origem: num(o.total_volumes_origem),
    total_volumes_destino: num(o.total_volumes_destino),
    peso_total_origem: num(o.peso_total_origem),
    faturamento_origem: num(o.faturamento_origem),
    qtd_coletas: num(o.qtd_coletas),
    qtd_entregas: num(o.qtd_entregas),
    qtd_manifestos: num(o.qtd_manifestos),
    saldo_ctes: num(o.saldo_ctes),
    saldo_volumes: num(o.saldo_volumes),
    volumes_por_cte: num(o.volumes_por_cte),
    peso_por_cte: num(o.peso_por_cte),
    ticket_por_cte: num(o.ticket_por_cte),
  };
}

export async function selectDesempenhoAgenciasDataset(pool: Pool, url: URL): Promise<DesempenhoAgenciasDataset> {
  const p = parseScopedParams(url);
  const values: unknown[] = [];
  pushScopeValues(values, p);

  const sqlKpis = `
    WITH ${CTE_F}
    SELECT
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.volumes), 0)::bigint AS total_volumes,
      COALESCE(sum(f.flg_coleta), 0)::bigint AS qtd_coletas,
      COALESCE(sum(f.flg_entrega), 0)::bigint AS qtd_entregas,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total,
      COALESCE(sum(f.flg_manifesto), 0)::bigint AS qtd_manifestos
    FROM f
  `;

  const sqlEvo = `
    WITH ${CTE_F}
    SELECT
      date_trunc('month', f.data_referencia)::date AS mes_referencia,
      count(*)::bigint AS total_ctes,
      COALESCE(sum(f.volumes), 0)::bigint AS total_volumes,
      COALESCE(sum(f.peso), 0)::numeric AS peso_total,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_total
    FROM f
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const sqlRanking = `
    WITH ${CTE_F}
    SELECT
      f.agencia_origem AS agencia,
      count(*)::bigint AS total_ctes_origem,
      COALESCE(sum(f.volumes), 0)::bigint AS total_volumes_origem,
      COALESCE(sum(f.valor_total), 0)::numeric AS faturamento_origem
    FROM f
    WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
    GROUP BY 1
    ORDER BY total_ctes_origem DESC NULLS LAST
    LIMIT 12
  `;

  const sqlColetas = `
    WITH ${CTE_F}
    SELECT
      f.agencia_origem AS agencia,
      COALESCE(sum(f.flg_coleta), 0)::bigint AS qtd_coletas,
      COALESCE(sum(f.flg_entrega), 0)::bigint AS qtd_entregas
    FROM f
    WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
    GROUP BY 1
    ORDER BY (COALESCE(sum(f.flg_coleta), 0) + COALESCE(sum(f.flg_entrega), 0)) DESC
    LIMIT 12
  `;

  const sqlTable = `
    WITH ${CTE_F},
    orig AS (
      SELECT
        f.agencia_origem AS agencia,
        count(*)::bigint AS ctes_o,
        COALESCE(sum(f.volumes), 0)::bigint AS vol_o,
        COALESCE(sum(f.peso), 0)::numeric AS peso_o,
        COALESCE(sum(f.valor_total), 0)::numeric AS fat_o,
        COALESCE(sum(f.flg_coleta), 0)::bigint AS col_o,
        COALESCE(sum(f.flg_entrega), 0)::bigint AS ent_o,
        COALESCE(sum(f.flg_manifesto), 0)::bigint AS man_o
      FROM f
      WHERE trim(COALESCE(f.agencia_origem, '')) <> ''
      GROUP BY 1
    ),
    dest AS (
      SELECT
        f.agencia_destino AS agencia,
        count(*)::bigint AS ctes_d,
        COALESCE(sum(f.volumes), 0)::bigint AS vol_d
      FROM f
      WHERE trim(COALESCE(f.agencia_destino, '')) <> ''
      GROUP BY 1
    ),
    all_ag AS (
      SELECT agencia FROM orig
      UNION
      SELECT agencia FROM dest
    )
    SELECT
      trim(a.agencia) AS agencia,
      COALESCE(o.ctes_o, 0::bigint) AS total_ctes_origem,
      COALESCE(d.ctes_d, 0::bigint) AS total_ctes_destino,
      COALESCE(o.vol_o, 0::bigint) AS total_volumes_origem,
      COALESCE(d.vol_d, 0::bigint) AS total_volumes_destino,
      COALESCE(o.peso_o, 0::numeric) AS peso_total_origem,
      COALESCE(o.fat_o, 0::numeric) AS faturamento_origem,
      COALESCE(o.col_o, 0::bigint) AS qtd_coletas,
      COALESCE(o.ent_o, 0::bigint) AS qtd_entregas,
      COALESCE(o.man_o, 0::bigint) AS qtd_manifestos,
      (COALESCE(o.ctes_o, 0::bigint) - COALESCE(d.ctes_d, 0::bigint))::bigint AS saldo_ctes,
      (COALESCE(o.vol_o, 0::bigint) - COALESCE(d.vol_d, 0::bigint))::bigint AS saldo_volumes,
      CASE WHEN COALESCE(o.ctes_o, 0::bigint) > 0 THEN (COALESCE(o.vol_o, 0::bigint)::numeric / o.ctes_o::numeric) ELSE 0::numeric END AS volumes_por_cte,
      CASE WHEN COALESCE(o.ctes_o, 0::bigint) > 0 THEN (COALESCE(o.peso_o, 0::numeric) / o.ctes_o::numeric) ELSE 0::numeric END AS peso_por_cte,
      CASE WHEN COALESCE(o.ctes_o, 0::bigint) > 0 THEN (COALESCE(o.fat_o, 0::numeric) / o.ctes_o::numeric) ELSE 0::numeric END AS ticket_por_cte
    FROM all_ag a
    LEFT JOIN orig o ON o.agencia = a.agencia
    LEFT JOIN dest d ON d.agencia = a.agencia
    ORDER BY COALESCE(o.ctes_o, 0::bigint) DESC NULLS LAST, trim(a.agencia) ASC
  `;

  const [rK, rE, rR, rC, rT] = await Promise.all([
    pool.query(sqlKpis, values),
    pool.query(sqlEvo, values),
    pool.query(sqlRanking, values),
    pool.query(sqlColetas, values),
    pool.query(sqlTable, values),
  ]);

  const k0 = (rK.rows[0] || {}) as Record<string, unknown>;
  const kpis = parseKpisRow(k0);

  const table = (rT.rows || []).map((row) => parseTableRow(row as Record<string, unknown>));

  const evolucaoMensal = (rE.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    const mr = o.mes_referencia;
    const mes_referencia =
      mr instanceof Date ? mr.toISOString().slice(0, 10) : String(mr ?? "").slice(0, 10);
    return {
      mes_referencia,
      total_ctes: num(o.total_ctes),
      total_volumes: num(o.total_volumes),
      peso_total: num(o.peso_total),
      faturamento_total: num(o.faturamento_total),
    };
  });

  const ranking = (rR.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      agencia: String(o.agencia ?? ""),
      total_ctes_origem: num(o.total_ctes_origem),
      total_volumes_origem: num(o.total_volumes_origem),
      faturamento_origem: num(o.faturamento_origem),
    };
  });

  const coletasEntregas = (rC.rows || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      agencia: String(o.agencia ?? ""),
      qtd_coletas: num(o.qtd_coletas),
      qtd_entregas: num(o.qtd_entregas),
    };
  });

  const saldoMalha = [...table]
    .map((t) => ({
      agencia: t.agencia,
      saldo_ctes: t.saldo_ctes,
      saldo_volumes: t.saldo_volumes,
    }))
    .sort((a, b) => Math.abs(b.saldo_ctes) - Math.abs(a.saldo_ctes))
    .slice(0, 15);

  const produtividade = [...table]
    .filter((t) => t.total_ctes_origem > 0)
    .sort((a, b) => b.total_ctes_origem - a.total_ctes_origem)
    .slice(0, 10)
    .map((t) => ({
      agencia: t.agencia,
      volumes_por_cte: t.volumes_por_cte,
      peso_por_cte: t.peso_por_cte,
      ticket_por_cte: t.ticket_por_cte,
    }));

  return {
    kpis,
    evolucaoMensal,
    ranking,
    coletasEntregas,
    saldoMalha,
    produtividade,
    table,
  };
}

export async function selectDesempenhoAgenciasDrill(pool: Pool, url: URL): Promise<DesempenhoAgenciasDrill> {
  const p = parseScopedParams(url);
  const agencia = (url.searchParams.get("agencia") || "").trim();
  if (!agencia) {
    return { summary: null, lines: [] };
  }
  const values: unknown[] = [];
  pushScopeValues(values, p);
  values.push(agencia);

  const sqlTableOne = `
    WITH ${CTE_F}
    SELECT
      trim($6::text) AS agencia,
      (SELECT count(*)::bigint FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS total_ctes_origem,
      (SELECT count(*)::bigint FROM f WHERE trim(f.agencia_destino) = trim($6::text)) AS total_ctes_destino,
      (SELECT COALESCE(sum(f.volumes), 0::bigint) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS total_volumes_origem,
      (SELECT COALESCE(sum(f.volumes), 0::bigint) FROM f WHERE trim(f.agencia_destino) = trim($6::text)) AS total_volumes_destino,
      (SELECT COALESCE(sum(f.peso), 0::numeric) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS peso_total_origem,
      (SELECT COALESCE(sum(f.valor_total), 0::numeric) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS faturamento_origem,
      (SELECT COALESCE(sum(f.flg_coleta), 0::bigint) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS qtd_coletas,
      (SELECT COALESCE(sum(f.flg_entrega), 0::bigint) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS qtd_entregas,
      (SELECT COALESCE(sum(f.flg_manifesto), 0::bigint) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) AS qtd_manifestos,
      (
        (SELECT count(*)::bigint FROM f WHERE trim(f.agencia_origem) = trim($6::text))
        - (SELECT count(*)::bigint FROM f WHERE trim(f.agencia_destino) = trim($6::text))
      )::bigint AS saldo_ctes,
      (
        (SELECT COALESCE(sum(f.volumes), 0::bigint) FROM f WHERE trim(f.agencia_origem) = trim($6::text))
        - (SELECT COALESCE(sum(f.volumes), 0::bigint) FROM f WHERE trim(f.agencia_destino) = trim($6::text))
      )::bigint AS saldo_volumes,
      CASE
        WHEN (SELECT count(*) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) > 0 THEN (
          (SELECT COALESCE(sum(f.volumes), 0::bigint)::numeric FROM f WHERE trim(f.agencia_origem) = trim($6::text))
          / (SELECT count(*)::numeric FROM f WHERE trim(f.agencia_origem) = trim($6::text))
        )
        ELSE 0::numeric
      END AS volumes_por_cte,
      CASE
        WHEN (SELECT count(*) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) > 0 THEN (
          (SELECT COALESCE(sum(f.peso), 0::numeric) FROM f WHERE trim(f.agencia_origem) = trim($6::text))
          / (SELECT count(*)::numeric FROM f WHERE trim(f.agencia_origem) = trim($6::text))
        )
        ELSE 0::numeric
      END AS peso_por_cte,
      CASE
        WHEN (SELECT count(*) FROM f WHERE trim(f.agencia_origem) = trim($6::text)) > 0 THEN (
          (SELECT COALESCE(sum(f.valor_total), 0::numeric) FROM f WHERE trim(f.agencia_origem) = trim($6::text))
          / (SELECT count(*)::numeric FROM f WHERE trim(f.agencia_origem) = trim($6::text))
        )
        ELSE 0::numeric
      END AS ticket_por_cte
  `;

  const sqlLines = `
    SELECT ${NF_LINE_SELECT}
    FROM tb_nf_saidas_consolidada n
    WHERE ${NF_SCOPE_WHERE}
      AND (trim(COALESCE(n.coleta, '')) = trim($6::text) OR trim(COALESCE(n.entrega, '')) = trim($6::text))
    ORDER BY n.data_emissao::date DESC, n.id_unico ASC
    LIMIT 500
  `;

  const [rS, rL] = await Promise.all([pool.query(sqlTableOne, values), pool.query(sqlLines, values)]);

  const summaryRow = rS.rows[0] as Record<string, unknown> | undefined;
  const summary = summaryRow ? parseTableRow(summaryRow) : null;
  const lines = (rL.rows || []).map((row) => serializePgRow(row as Record<string, unknown>));

  return { summary, lines };
}

const MAX_EXPORT_MOVIMENTOS = 80_000;

/** Linhas ao nível CTE para Excel (mesmo grão do drill), com limite de segurança. */
export async function selectDesempenhoAgenciasExportMovimentos(
  pool: Pool,
  url: URL,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const focus = (url.searchParams.get("agencia_foco") || "").trim();
  const values: unknown[] = [];
  pushScopeValues(values, parseScopedParams(url));
  let extraWhere = "";
  if (focus) {
    values.push(focus);
    extraWhere = ` AND (trim(COALESCE(n.coleta, '')) = trim($${values.length}::text) OR trim(COALESCE(n.entrega, '')) = trim($${values.length}::text))`;
  }
  const sql = `
    SELECT ${NF_LINE_SELECT}
    FROM tb_nf_saidas_consolidada n
    WHERE ${NF_SCOPE_WHERE}
    ${extraWhere}
    ORDER BY n.data_emissao::date DESC, n.id_unico ASC
    LIMIT ${MAX_EXPORT_MOVIMENTOS + 1}
  `;
  const r = await pool.query(sql, values);
  const truncated = r.rows.length > MAX_EXPORT_MOVIMENTOS;
  const slice = (r.rows || []).slice(0, MAX_EXPORT_MOVIMENTOS);
  const rows = slice.map((row) => serializePgRow(row as Record<string, unknown>));
  return { rows, truncated };
}
