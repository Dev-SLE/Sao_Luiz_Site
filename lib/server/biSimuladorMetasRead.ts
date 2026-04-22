import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import { getBiComissoesVendedorAllowlistUpper } from "@/modules/bi/comissoes/config";
import {
  BI_SIMULADOR_METAS_CONFIG,
  SIMULADOR_METAS_DEFAULT_FROM,
  SIMULADOR_METAS_DEFAULT_TO,
} from "@/modules/bi/simuladorMetas/config";
import type { SimuladorMesRow } from "@/modules/bi/simuladorMetas/types";

/** Igual ao BI Comissões: sem linhas “sem vendedor” / vazio. */
const SEM_VENDEDOR_SQL = `lower(trim(r.vendedor)) <> 'sem vendedor'`;

export type { SimuladorMesRow };

function collectMulti(url: URL, key: string): string[] {
  const out: string[] = [];
  for (const v of url.searchParams.getAll(key)) {
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function normalizeMonthBoundary(iso: string | null, fallback: string): string {
  const s = (iso ?? fallback).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  return `${s.slice(0, 7)}-01`;
}

export async function selectSimuladorMetasFacetOptions(pool: Pool): Promise<{
  vendedores: string[];
  tiposComissao: string[];
}> {
  const allow = getBiComissoesVendedorAllowlistUpper();
  const vParams: unknown[] = [];
  let vWhere = `trim(r.vendedor) IS NOT NULL AND trim(r.vendedor) <> '' AND ${SEM_VENDEDOR_SQL}`;
  if (allow?.length) {
    vParams.push(allow);
    vWhere += ` AND upper(trim(r.vendedor)) = ANY($${vParams.length}::text[])`;
  }
  const vSql = `
    SELECT DISTINCT trim(r.vendedor) AS v
    FROM ${BI_SIMULADOR_METAS_CONFIG.views.ready} r
    WHERE ${vWhere}
    ORDER BY 1
  `;
  const tParts = [
    `c.tipo_comissao IS NOT NULL AND trim(c.tipo_comissao) <> ''`,
    `c.vendedor_final IS NOT NULL AND trim(c.vendedor_final) <> ''`,
    `lower(trim(c.vendedor_final)) <> 'sem vendedor'`,
  ];
  const tParams: unknown[] = [];
  if (allow?.length) {
    tParams.push(allow);
    tParts.push(`upper(trim(c.vendedor_final)) = ANY($${tParams.length}::text[])`);
  }
  const tSql = `
    SELECT DISTINCT trim(c.tipo_comissao) AS t
    FROM ${BI_SIMULADOR_METAS_CONFIG.comissoesTable} c
    WHERE ${tParts.join(" AND ")}
    ORDER BY 1
  `;
  const [vr, tr] = await Promise.all([
    pool.query<{ v: string }>(vSql, vParams),
    pool.query<{ t: string }>(tSql, tParams),
  ]);
  return {
    vendedores: vr.rows.map((r) => r.v).filter(Boolean),
    tiposComissao: tr.rows.map((r) => r.t).filter(Boolean),
  };
}

/**
 * Linhas mensais 2025 (`ready`) com filtros de período (mês-referência), vendedor e tipo de comissão.
 */
export async function selectSimuladorMetasDataset(pool: Pool, url: URL): Promise<SimuladorMesRow[]> {
  let from = normalizeMonthBoundary(url.searchParams.get("from"), SIMULADOR_METAS_DEFAULT_FROM);
  let to = normalizeMonthBoundary(url.searchParams.get("to"), SIMULADOR_METAS_DEFAULT_TO);
  if (from > to) {
    const t = from;
    from = to;
    to = t;
  }
  const vendedores = collectMulti(url, "vendedor");
  const tipos = collectMulti(url, "tipo_comissao");
  const allow = getBiComissoesVendedorAllowlistUpper();

  const values: unknown[] = [from, to];
  let sql = `
    SELECT
      r.vendedor,
      r.ano,
      r.mes_referencia,
      r.mes_num,
      r.mes_nome,
      r.qtd_ctes_real,
      r.venda_realizada,
      r.ticket_medio,
      r.dias_uteis_2025,
      r.dias_uteis_2026,
      r.media_diaria_2025
    FROM ${BI_SIMULADOR_METAS_CONFIG.views.ready} r
    WHERE r.mes_referencia >= $1::date
      AND r.mes_referencia <= $2::date
      AND trim(r.vendedor) IS NOT NULL AND trim(r.vendedor) <> ''
      AND ${SEM_VENDEDOR_SQL}
  `;

  const allowSet = allow?.length ? new Set(allow.map((a) => a.toUpperCase())) : null;
  let vendUpperForSql: string[] | null = null;
  if (allowSet?.size) {
    const picked = vendedores
      .map((v) => v.trim().toUpperCase())
      .filter((v) => allowSet.has(v));
    vendUpperForSql = vendedores.length ? (picked.length ? picked : [...allowSet]) : [...allowSet];
  } else if (vendedores.length) {
    vendUpperForSql = vendedores.map((v) => v.trim().toUpperCase());
  }
  if (vendUpperForSql?.length) {
    values.push(vendUpperForSql);
    sql += ` AND upper(trim(r.vendedor)) = ANY($${values.length}::text[])`;
  }
  if (tipos.length) {
    values.push(tipos);
    sql += `
      AND EXISTS (
        SELECT 1
        FROM ${BI_SIMULADOR_METAS_CONFIG.comissoesTable} c
        WHERE trim(c.vendedor_final) = trim(r.vendedor)
          AND date_trunc('month', c.data_emissao::date) = r.mes_referencia
          AND trim(c.tipo_comissao) = ANY($${values.length}::text[])
      )
    `;
  }
  sql += ` ORDER BY r.vendedor ASC, r.mes_num ASC`;

  const res = await pool.query(sql, values);
  return res.rows.map((row) => {
    const o = serializePgRow(row as Record<string, unknown>);
    return {
      vendedor: String(o.vendedor ?? ""),
      ano: Number(o.ano ?? 0),
      mes_referencia: typeof o.mes_referencia === "string" ? o.mes_referencia : String(o.mes_referencia ?? ""),
      mes_num: Number(o.mes_num ?? 0),
      mes_nome: String(o.mes_nome ?? ""),
      qtd_ctes_real: Number(o.qtd_ctes_real ?? 0),
      venda_realizada: Number(o.venda_realizada ?? 0),
      ticket_medio: Number(o.ticket_medio ?? 0),
      dias_uteis_2025: Number(o.dias_uteis_2025 ?? 0),
      dias_uteis_2026: Number(o.dias_uteis_2026 ?? 0),
      media_diaria_2025: Number(o.media_diaria_2025 ?? 0),
    };
  });
}
