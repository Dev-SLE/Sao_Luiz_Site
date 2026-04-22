import type { Pool } from "pg";
import { serializePgRow } from "@/lib/server/biComissoesRead";
import {
  BI_PLANEJAMENTO_AGENCIAS_CONFIG,
  PLANEJAMENTO_DEFAULT_FROM,
  PLANEJAMENTO_DEFAULT_TO,
} from "@/modules/bi/planejamentoAgencias/config";
import type { PlanejamentoAtualRow, PlanejamentoReadyRow } from "@/modules/bi/planejamentoAgencias/types";

export type { PlanejamentoAtualRow, PlanejamentoReadyRow };

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

/** Mesmo mês/dia, outro ano (ex.: 2025-03-01 → 2026-03-01). */
function sameMonthOtherYear(iso: string, targetYear: number): string {
  const y = Number(iso.slice(0, 4));
  if (!Number.isFinite(y)) return iso;
  return `${targetYear}${iso.slice(4, 10)}`;
}

function parseReadyRow(o: Record<string, unknown>): PlanejamentoReadyRow {
  return {
    agencia: String(o.agencia ?? ""),
    agencia_normalizada: String(o.agencia_normalizada ?? ""),
    ano: Number(o.ano ?? 0),
    mes_referencia: typeof o.mes_referencia === "string" ? o.mes_referencia : String(o.mes_referencia ?? ""),
    mes_num: Number(o.mes_num ?? 0),
    mes_nome: String(o.mes_nome ?? ""),
    qtd_ctes: Number(o.qtd_ctes ?? 0),
    faturamento_realizado: Number(o.faturamento_realizado ?? 0),
    dias_uteis_ano_base: Number(o.dias_uteis_ano_base ?? 0),
    dias_uteis_ano_meta: Number(o.dias_uteis_ano_meta ?? 0),
    media_diaria_ano_base: Number(o.media_diaria_ano_base ?? 0),
    peso_sazonal_agencia: Number(o.peso_sazonal_agencia ?? 0),
  };
}

function parseAtualRow(o: Record<string, unknown>): PlanejamentoAtualRow {
  return {
    agencia: String(o.agencia ?? ""),
    mes_num: Number(o.mes_num ?? 0),
    mes_nome: String(o.mes_nome ?? ""),
    mes_referencia: typeof o.mes_referencia === "string" ? o.mes_referencia : String(o.mes_referencia ?? ""),
    qtd_ctes: Number(o.qtd_ctes ?? 0),
    faturamento_atual: Number(o.faturamento_atual ?? 0),
  };
}

export async function selectPlanejamentoAgenciasFacetOptions(pool: Pool): Promise<{ agencias: string[] }> {
  const sql = `
    SELECT DISTINCT trim(agencia) AS a
    FROM ${BI_PLANEJAMENTO_AGENCIAS_CONFIG.views.filters}
    WHERE trim(agencia) IS NOT NULL AND trim(agencia) <> ''
    ORDER BY 1
  `;
  const r = await pool.query<{ a: string }>(sql);
  return { agencias: r.rows.map((x) => x.a).filter(Boolean) };
}

export type PlanejamentoDataset = {
  ready: PlanejamentoReadyRow[];
  atual: PlanejamentoAtualRow[];
  anoBase: number;
  anoAtual: number;
};

export async function selectPlanejamentoAgenciasDataset(pool: Pool, url: URL): Promise<PlanejamentoDataset> {
  const { anoBase, anoRealizadoAtual } = BI_PLANEJAMENTO_AGENCIAS_CONFIG;

  let from = normalizeMonthBoundary(url.searchParams.get("from"), PLANEJAMENTO_DEFAULT_FROM);
  let to = normalizeMonthBoundary(url.searchParams.get("to"), PLANEJAMENTO_DEFAULT_TO);
  if (from > to) {
    const t = from;
    from = to;
    to = t;
  }
  const agencias = collectMulti(url, "agencia");

  const valuesR: unknown[] = [from, to];
  let sqlR = `
    SELECT
      r.agencia,
      r.agencia_normalizada,
      r.ano,
      r.mes_referencia,
      r.mes_num,
      r.mes_nome,
      r.qtd_ctes,
      r.faturamento_realizado,
      r.dias_uteis_ano_base,
      r.dias_uteis_ano_meta,
      r.media_diaria_ano_base,
      r.peso_sazonal_agencia
    FROM ${BI_PLANEJAMENTO_AGENCIAS_CONFIG.views.ready} r
    WHERE r.mes_referencia >= $1::date
      AND r.mes_referencia <= $2::date
  `;
  if (agencias.length) {
    valuesR.push(agencias);
    sqlR += ` AND trim(r.agencia) = ANY($${valuesR.length}::text[])`;
  }
  sqlR += ` ORDER BY r.agencia ASC, r.mes_num ASC`;

  const fromAtual = sameMonthOtherYear(from, anoRealizadoAtual);
  const toAtual = sameMonthOtherYear(to, anoRealizadoAtual);

  const valuesA: unknown[] = [fromAtual, toAtual, anoRealizadoAtual];
  let sqlA = `
    SELECT
      trim(m.agencia) AS agencia,
      m.mes_num,
      m.mes_nome,
      m.mes_referencia,
      m.qtd_ctes,
      m.faturamento_realizado AS faturamento_atual
    FROM ${BI_PLANEJAMENTO_AGENCIAS_CONFIG.views.mensal} m
    WHERE m.ano = $3::int
      AND m.mes_referencia >= $1::date
      AND m.mes_referencia <= $2::date
  `;
  if (agencias.length) {
    valuesA.push(agencias);
    sqlA += ` AND trim(m.agencia) = ANY($${valuesA.length}::text[])`;
  }
  sqlA += ` ORDER BY m.agencia ASC, m.mes_num ASC`;

  const [resR, resA] = await Promise.all([pool.query(sqlR, valuesR), pool.query(sqlA, valuesA)]);

  return {
    ready: resR.rows.map((row) => parseReadyRow(serializePgRow(row as Record<string, unknown>))),
    atual: resA.rows.map((row) => parseAtualRow(serializePgRow(row as Record<string, unknown>))),
    anoBase,
    anoAtual: anoRealizadoAtual,
  };
}

/** Expõe ano da meta (dias úteis) para o cliente alinhar textos. */
export function getPlanejamentoAnoMetaDias(): number {
  return BI_PLANEJAMENTO_AGENCIAS_CONFIG.anoMetaDias;
}
