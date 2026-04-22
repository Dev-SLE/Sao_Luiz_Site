/**
 * Exportação XLSX com identidade visual São Luiz / gerencial (ExcelJS).
 * Reutilizar em qualquer módulo: passe título, filtros, colunas e linhas.
 */
import ExcelJS from "exceljs";

/** Paleta alinhada ao dashboard (sl-navy, slate, borda clara). */
export const BRANDED_EXCEL_COLORS = {
  navy: "FF1E3A5F",
  navyLight: "FF2A4A7A",
  headerSlate: "FF64748B",
  border: "FFE2E8F0",
  zebra: "FFF8FAFC",
  text: "FF0F172A",
  textMuted: "FF64748B",
  textFilter: "FF334155",
  filterBg: "FFF1F5F9",
  footer: "FF94A3B8",
  white: "FFFFFFFF",
  subtitleOnNavy: "FFE2E8F0",
} as const;

export type BrandedExcelColumnFormat = "datetime" | "date" | "currency" | "integer" | "text";

export type BrandedExcelColumn = {
  key: string;
  label: string;
  width?: number;
  format?: BrandedExcelColumnFormat;
};

export type BrandedExcelExportConfig = {
  /** Nome da aba (curto, sem caracteres inválidos). */
  sheetName: string;
  /** Título principal (faixa superior). */
  documentTitle: string;
  /** Subtítulo na segunda faixa (ex.: tipo de relatório). */
  tagline?: string;
  /** Linhas de contexto (período, filtros). Juntadas na célula mesclada. */
  filterSummaryLines: string[];
  /** Linha 4: ex. "Gerado em … · N linha(s)". */
  generatedMetaLine: string;
  columns: BrandedExcelColumn[];
  rows: Record<string, unknown>[];
  /** Rodapé mesclado (opcional). */
  footerNote?: string;
  /** Metadado do arquivo. */
  workbookCreator?: string;
};

function toDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const DEFAULT_WIDTH = 16;

/** Adiciona uma aba ao workbook com o layout padrão gerencial (faixa título, filtros, tabela, rodapé). */
export function addBrandedSheetToWorkbook(wb: ExcelJS.Workbook, config: BrandedExcelExportConfig): void {
  const ws = wb.addWorksheet(config.sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 5 }],
    properties: { defaultRowHeight: 18 },
  });

  const lastCol = Math.max(1, config.columns.length);
  const C = BRANDED_EXCEL_COLORS;

  ws.mergeCells(1, 1, 1, lastCol);
  const title = ws.getCell(1, 1);
  title.value = config.documentTitle;
  title.font = { size: 20, bold: true, color: { argb: C.white } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navy } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  ws.mergeCells(2, 1, 2, lastCol);
  const sub = ws.getCell(2, 1);
  sub.value = config.tagline ?? "Exportação gerencial";
  sub.font = { size: 11, italic: true, color: { argb: C.subtitleOnNavy } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navyLight } };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 22;

  const filterLines = config.filterSummaryLines;
  ws.mergeCells(3, 1, 3, lastCol);
  const filt = ws.getCell(3, 1);
  filt.value = filterLines.length ? filterLines.join("  ·  ") : "Sem filtros adicionais.";
  filt.font = { size: 10, color: { argb: C.textFilter } };
  filt.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.filterBg } };
  filt.alignment = { vertical: "middle", horizontal: "left", wrapText: true } as ExcelJS.Alignment;
  ws.getRow(3).height = Math.max(28, 16 + filterLines.length * 14);

  ws.mergeCells(4, 1, 4, lastCol);
  const meta = ws.getCell(4, 1);
  meta.value = config.generatedMetaLine;
  meta.font = { size: 9, color: { argb: C.textMuted } };
  meta.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.white } };
  ws.getRow(4).height = 18;

  const headerRow = ws.getRow(5);
  config.columns.forEach((col, idx) => {
    const c = headerRow.getCell(idx + 1);
    c.value = col.label;
    c.font = { bold: true, size: 11, color: { argb: C.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerSlate } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true } as ExcelJS.Alignment;
    c.border = {
      top: { style: "thin", color: { argb: C.border } },
      left: { style: "thin", color: { argb: C.border } },
      bottom: { style: "thin", color: { argb: C.border } },
      right: { style: "thin", color: { argb: C.border } },
    };
  });
  headerRow.height = 26;

  config.columns.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width ?? DEFAULT_WIDTH;
  });

  config.rows.forEach((row, ri) => {
    const r = ws.getRow(6 + ri);
    const zebra = ri % 2 === 1;
    config.columns.forEach((col, ci) => {
      const cell = r.getCell(ci + 1);
      const raw = row[col.key];
      const fmt = col.format ?? "text";

      if (fmt === "datetime") {
        const d = toDate(raw);
        cell.value = d ?? "";
        if (d) cell.numFmt = "dd/mm/yyyy hh:mm";
      } else if (fmt === "date") {
        const d = toDate(raw);
        cell.value = d ?? "";
        if (d) cell.numFmt = "dd/mm/yyyy";
      } else if (fmt === "currency") {
        cell.value = toNum(raw);
        cell.numFmt = '"R$" #,##0.00';
      } else if (fmt === "integer") {
        cell.value = raw != null && raw !== "" ? toNum(raw) : raw;
        if (typeof cell.value === "number") cell.numFmt = "0";
      } else {
        cell.value = raw != null && raw !== "" ? String(raw) : "";
      }

      cell.font = { size: 10, color: { argb: C.text } };
      cell.fill = zebra
        ? { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } }
        : { type: "pattern", pattern: "solid", fgColor: { argb: C.white } };
      cell.border = {
        top: { style: "thin", color: { argb: C.border } },
        left: { style: "thin", color: { argb: C.border } },
        bottom: { style: "thin", color: { argb: C.border } },
        right: { style: "thin", color: { argb: C.border } },
      };
      cell.alignment = { vertical: "middle", wrapText: true } as ExcelJS.Alignment;
    });
    r.height = 20;
  });

  const footRow = 6 + config.rows.length + 1;
  ws.mergeCells(footRow, 1, footRow, lastCol);
  const foot = ws.getCell(footRow, 1);
  foot.value = config.footerNote ?? "Documento confidencial — uso interno.";
  foot.font = { size: 9, italic: true, color: { argb: C.footer } };
  foot.alignment = { horizontal: "center" };
}

export async function buildBrandedExcelBuffer(config: BrandedExcelExportConfig): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = config.workbookCreator ?? "São Luiz Express — Gerencial";
  wb.created = new Date();
  addBrandedSheetToWorkbook(wb, config);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
