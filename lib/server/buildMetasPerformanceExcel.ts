/**
 * Metas & performance — layout `brandedExcelExport`, colunas alinhadas à tabela da UI.
 */
import {
  type BrandedExcelColumn,
  addBrandedSheetToWorkbook,
} from "@/lib/server/brandedExcelExport";
import ExcelJS from "exceljs";
import {
  BI_METAS_PERFORMANCE_CONFIG,
  METAS_TABELA_COLUNAS,
} from "@/modules/bi/metasPerformance/config";
import { collectMetasAgenciaFilters, resolveMetasPeriodIso } from "@/lib/server/biMetasPerformanceRead";

type Row = Record<string, unknown>;

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtPctRatio(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = toNum(v);
  return `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

export function summarizeMetasPerformanceExportFilters(url: URL): string[] {
  const lines: string[] = [];
  const { from, to } = resolveMetasPeriodIso(url);
  lines.push(`Período: ${from} a ${to}`);
  const ags = collectMetasAgenciaFilters(url);
  const ak = BI_METAS_PERFORMANCE_CONFIG.filters.agencia;
  if (ags.length) lines.push(`Agência(s) (${ak}): ${ags.join(", ")}`);
  return lines;
}

function metasColumnDefs(): BrandedExcelColumn[] {
  const widths: Record<string, number> = {
    agencia: 28,
    meta_mes: 18,
    realizado: 18,
    pct_projetado: 14,
    projecao_smart: 20,
    faturamento_ly: 20,
    pct_crescimento: 14,
    meta_diaria: 16,
  };
  return METAS_TABELA_COLUNAS.map((c) => ({
    key: c.key,
    label: c.label,
    width: widths[c.key] ?? 16,
    format:
      c.key === "agencia" || c.key === "pct_projetado" || c.key === "pct_crescimento"
        ? ("text" as const)
        : ("currency" as const),
  }));
}

function mapRowsForExport(rows: Row[]): Row[] {
  return rows.map((r) => ({
    agencia: String(r.agencia ?? ""),
    meta_mes: toNum(r.meta_mes),
    realizado: toNum(r.realizado),
    pct_projetado: fmtPctRatio(r.pct_projetado),
    projecao_smart: toNum(r.projecao_smart),
    faturamento_ly: toNum(r.realizado_ly),
    pct_crescimento: r.pct_crescimento == null || String(r.pct_crescimento) === "" ? "—" : fmtPctRatio(r.pct_crescimento),
    meta_diaria: toNum(r.meta_diaria),
  }));
}

export async function buildMetasPerformanceExcelBuffer(rows: Row[], url: URL): Promise<Buffer> {
  const filterSummaryLines = summarizeMetasPerformanceExportFilters(url);
  const exportRows = mapRowsForExport(rows);
  const generatedMetaLine = `Gerado em ${new Date().toLocaleString("pt-BR")}  ·  ${exportRows.length} linha(s)`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "São Luiz Express — Gerencial";
  wb.created = new Date();

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Metas por agência",
    documentTitle: "Metas & performance",
    tagline: "Agências — meta, realizado e projeção — exportação gerencial",
    filterSummaryLines,
    generatedMetaLine,
    columns: metasColumnDefs(),
    rows: exportRows,
    footerNote: "Documento confidencial — uso interno.",
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
