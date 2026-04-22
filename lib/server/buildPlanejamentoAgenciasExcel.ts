/**
 * Planejamento agências — duas abas no padrão `brandedExcelExport` (por agência + mensal).
 */
import ExcelJS from "exceljs";
import {
  type BrandedExcelColumn,
  addBrandedSheetToWorkbook,
} from "@/lib/server/brandedExcelExport";
import type { PlanejamentoAtualRow, PlanejamentoReadyRow } from "@/modules/bi/planejamentoAgencias/types";

type Row = Record<string, unknown>;

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function metaMes(r: PlanejamentoReadyRow, growthDec: number): number {
  return r.media_diaria_ano_base * r.dias_uteis_ano_meta * (1 + growthDec);
}

function desafioFromGapPct(pct: number): { label: string; alto: boolean } {
  if (pct <= 3) return { label: "Leve", alto: false };
  if (pct <= 8) return { label: "Moderado", alto: false };
  if (pct <= 15) return { label: "Forte", alto: true };
  return { label: "Agressivo", alto: true };
}

function sazonalidadeResumo(rows: PlanejamentoReadyRow[]): string {
  if (!rows.length) return "—";
  const scored = [...rows].sort((a, b) => b.peso_sazonal_agencia - a.peso_sazonal_agencia);
  const top = scored[0];
  const second = scored[1];
  const minP = scored[scored.length - 1]?.peso_sazonal_agencia ?? 0;
  if (top && minP > 0 && top.peso_sazonal_agencia / minP < 1.2) return "Mais equilibrada ao longo do ano.";
  const n2 = second && second.peso_sazonal_agencia > 0.08 ? ` e ${second.mes_nome}` : "";
  return `Pico relativo em ${top?.mes_nome ?? ""}${n2}.`;
}

function parseGrowthDec(url: URL): number {
  const c = url.searchParams.get("crescimento");
  if (c === null) return 0.1;
  const n = Number(String(c).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 20) return 0.1;
  return n / 100;
}

export function summarizePlanejamentoExportFilters(
  url: URL,
  meta: { anoBase: number; anoAtual: number; anoMetaDias: number },
): string[] {
  const lines: string[] = [];
  const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
  const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
  if (from && to) lines.push(`Período (mês): ${from.slice(0, 7)} a ${to.slice(0, 7)}`);
  const ags = url.searchParams.getAll("agencia").filter(Boolean);
  if (ags.length) lines.push(`Agência(s): ${ags.join(", ")}`);
  const pct = url.searchParams.get("crescimento");
  if (pct != null && pct !== "") lines.push(`Crescimento aplicado: ${pct.replace(".", ",")}%`);
  lines.push(`Ano base: ${meta.anoBase} · Ano atual: ${meta.anoAtual} · Ano meta (dias úteis): ${meta.anoMetaDias}`);
  return lines;
}

type AgenciaAgg = {
  agencia: string;
  base: number;
  meta: number;
  atual: number;
  ctes: number;
  trimestres: Set<number>;
};

function buildByAgenciaRows(
  ready: PlanejamentoReadyRow[],
  atual: PlanejamentoAtualRow[],
  growthDec: number,
): Row[] {
  const map = new Map<string, AgenciaAgg>();
  for (const r of ready) {
    const k = r.agencia.trim();
    const cur =
      map.get(k) ??
      ({
        agencia: k,
        base: 0,
        meta: 0,
        atual: 0,
        ctes: 0,
        trimestres: new Set<number>(),
      } as AgenciaAgg);
    cur.base += r.faturamento_realizado;
    cur.meta += metaMes(r, growthDec);
    cur.ctes += r.qtd_ctes;
    cur.trimestres.add(Math.floor((r.mes_num - 1) / 3));
    map.set(k, cur);
  }
  for (const r of atual) {
    const k = r.agencia.trim();
    const cur = map.get(k);
    if (cur) cur.atual += r.faturamento_atual;
  }

  const out: Row[] = [];
  for (const row of map.values()) {
    const nTrim = Math.max(1, row.trimestres.size);
    const mediaTrim = row.base / nTrim;
    const gap = row.meta - row.base;
    const pctAjuste = row.base > 0 ? ((row.meta - row.base) / row.base) * 100 : 0;
    const ticket = row.ctes > 0 ? row.base / row.ctes : 0;
    const diasAg = new Map<number, number>();
    for (const rr of ready) {
      if (rr.agencia.trim() === row.agencia) diasAg.set(rr.mes_num, rr.dias_uteis_ano_meta);
    }
    const sumD = [...diasAg.values()].reduce((s, d) => s + d, 0);
    const metaDiaria = sumD > 0 ? row.meta / sumD : 0;
    const rowsAg = ready.filter((x) => x.agencia.trim() === row.agencia);
    const sazonal = sazonalidadeResumo(rowsAg);
    const gapPct = row.base > 0 ? (gap / row.base) * 100 : pctAjuste;
    const d = desafioFromGapPct(gapPct);
    out.push({
      agencia: row.agencia,
      realizado_ano_base: row.base,
      media_trimestral: mediaTrim,
      meta_simulada: row.meta,
      pct_ajuste_simulado_pct: `${pctAjuste.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
      gap_financeiro: gap,
      realizado_atual: row.atual,
      qtd_ctes: row.ctes,
      ticket_medio: ticket,
      meta_diaria: metaDiaria,
      sazonalidade: sazonal,
      desafio: d.label,
    });
  }
  out.sort((a, b) => String(a.agencia).localeCompare(String(b.agencia), "pt-BR"));
  return out;
}

function buildMensalRows(ready: PlanejamentoReadyRow[], growthDec: number): Row[] {
  return [...ready]
    .map((r) => {
      const m = metaMes(r, growthDec);
      const gap = m - r.faturamento_realizado;
      const pct = r.faturamento_realizado > 0 ? (gap / r.faturamento_realizado) * 100 : 0;
      const metaDiMes = r.dias_uteis_ano_meta > 0 ? m / r.dias_uteis_ano_meta : 0;
      return {
        _mes_num: r.mes_num,
        mes_nome: r.mes_nome,
        agencia: r.agencia,
        qtd_ctes: r.qtd_ctes,
        realizado_base: r.faturamento_realizado,
        meta_simulada: m,
        gap,
        pct_crescimento_pct: `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
        dias_uteis_base: r.dias_uteis_ano_base,
        dias_uteis_meta: r.dias_uteis_ano_meta,
        meta_diaria_mes: metaDiMes,
        peso_sazonal_pct: `${(r.peso_sazonal_agencia * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
      };
    })
    .sort((a, b) =>
      String(a.agencia) === String(b.agencia)
        ? toNum(a._mes_num) - toNum(b._mes_num)
        : String(a.agencia).localeCompare(String(b.agencia), "pt-BR"),
    )
    .map(({ _mes_num: _n, ...rest }) => rest);
}

function colsPorAgencia(): BrandedExcelColumn[] {
  return [
    { key: "agencia", label: "Agência", width: 28, format: "text" },
    { key: "realizado_ano_base", label: "Realizado ano base", width: 18, format: "currency" },
    { key: "media_trimestral", label: "Média trimestral", width: 18, format: "currency" },
    { key: "meta_simulada", label: "Meta simulada", width: 18, format: "currency" },
    { key: "pct_ajuste_simulado_pct", label: "Ajuste simulado (%)", width: 16, format: "text" },
    { key: "gap_financeiro", label: "Gap financeiro", width: 18, format: "currency" },
    { key: "realizado_atual", label: "Realizado atual", width: 18, format: "currency" },
    { key: "qtd_ctes", label: "Qtd CT-es", width: 12, format: "integer" },
    { key: "ticket_medio", label: "Ticket médio", width: 16, format: "currency" },
    { key: "meta_diaria", label: "Meta diária", width: 16, format: "currency" },
    { key: "sazonalidade", label: "Sazonalidade", width: 36, format: "text" },
    { key: "desafio", label: "Desafio", width: 14, format: "text" },
  ];
}

function colsMensal(): BrandedExcelColumn[] {
  return [
    { key: "mes_nome", label: "Mês", width: 14, format: "text" },
    { key: "agencia", label: "Agência", width: 26, format: "text" },
    { key: "qtd_ctes", label: "Qtd CT-es", width: 11, format: "integer" },
    { key: "realizado_base", label: "Realizado ano base", width: 18, format: "currency" },
    { key: "meta_simulada", label: "Meta simulada", width: 18, format: "currency" },
    { key: "gap", label: "Gap", width: 16, format: "currency" },
    { key: "pct_crescimento_pct", label: "% crescimento", width: 14, format: "text" },
    { key: "dias_uteis_base", label: "Dias úteis base", width: 14, format: "integer" },
    { key: "dias_uteis_meta", label: "Dias úteis meta", width: 14, format: "integer" },
    { key: "meta_diaria_mes", label: "Meta diária mês", width: 16, format: "currency" },
    { key: "peso_sazonal_pct", label: "Peso sazonal", width: 14, format: "text" },
  ];
}

export async function buildPlanejamentoAgenciasExcelBuffer(
  ready: PlanejamentoReadyRow[],
  atual: PlanejamentoAtualRow[],
  url: URL,
  meta: { anoBase: number; anoAtual: number; anoMetaDias: number },
): Promise<Buffer> {
  const growthDec = parseGrowthDec(url);
  const filterLines = summarizePlanejamentoExportFilters(url, meta);
  const agRows = buildByAgenciaRows(ready, atual, growthDec);
  const mensalRows = buildMensalRows(ready, growthDec);
  const now = new Date().toLocaleString("pt-BR");

  const wb = new ExcelJS.Workbook();
  wb.creator = "São Luiz Express — Gerencial";
  wb.created = new Date();

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Por agência",
    documentTitle: "Planejamento estratégico das agências",
    tagline: "Detalhamento consolidado no período — exportação gerencial",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${agRows.length} linha(s)`,
    columns: colsPorAgencia(),
    rows: agRows,
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Mensal detalhado",
    documentTitle: "Planejamento estratégico das agências",
    tagline: "Tabela mensal por agência — exportação gerencial",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${mensalRows.length} linha(s)`,
    columns: colsMensal(),
    rows: mensalRows,
    footerNote: "Documento confidencial — uso interno.",
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
