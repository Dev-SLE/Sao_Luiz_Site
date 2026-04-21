/**
 * Planilha Carteira / tabelas combinadas — layout `brandedExcelExport`, mesmas colunas da tabela na UI.
 */
import {
  type BrandedExcelColumn,
  buildBrandedExcelBuffer,
} from "@/lib/server/brandedExcelExport";
import { resolveTcPeriod } from "@/lib/server/biTabelasCombinadasRead";
import {
  BI_TABELAS_COMBINADAS_CONFIG,
  TC_CARTEIRA_TABELA_COLUNAS,
} from "@/modules/bi/tabelasCombinadas/config";

type Row = Record<string, unknown>;

export function summarizeTcExportFilters(url: URL): string[] {
  const lines: string[] = [];
  const { from, to } = resolveTcPeriod(url);
  lines.push(`Validade (referência): ${from} a ${to}`);

  const F = BI_TABELAS_COMBINADAS_CONFIG.filters;
  const vs = url.searchParams.getAll(F.vendedor).filter(Boolean);
  if (vs.length) lines.push(`Vendedora(s): ${vs.join(", ")}`);
  const ss = url.searchParams.getAll(F.statusAtual).filter(Boolean);
  if (ss.length) lines.push(`Status: ${ss.join(", ")}`);
  const cs = url.searchParams.getAll(F.cliente).filter(Boolean);
  if (cs.length) lines.push(`Cliente(s): ${cs.join(", ")}`);
  const q = url.searchParams.get("search")?.trim();
  if (q) lines.push(`Busca: ${q}`);
  return lines;
}

function carteiraColumnDefs(): BrandedExcelColumn[] {
  const widths: Record<string, number> = {
    status_atual: 22,
    proxima_acao: 36,
    dias_p_vencer: 14,
    cliente: 38,
    tabela: 28,
    ultima_compra: 14,
    ltv_valor: 16,
    qtd_ctes: 12,
    total_volumes: 14,
    media_ticket: 16,
    vendedor: 22,
  };
  const formats: Partial<Record<string, BrandedExcelColumn["format"]>> = {
    ultima_compra: "date",
    ltv_valor: "currency",
    media_ticket: "currency",
    qtd_ctes: "integer",
    total_volumes: "integer",
    dias_p_vencer: "integer",
  };
  return TC_CARTEIRA_TABELA_COLUNAS.map((c) => ({
    key: c.key,
    label: c.label,
    width: widths[c.key] ?? 16,
    format: formats[c.key] ?? "text",
  }));
}

export async function buildTabelasCombinadasExcelBuffer(rows: Row[], url: URL): Promise<Buffer> {
  const filterSummaryLines = summarizeTcExportFilters(url);
  const generatedMetaLine = `Gerado em ${new Date().toLocaleString("pt-BR")}  ·  ${rows.length} linha(s)`;

  return buildBrandedExcelBuffer({
    sheetName: "Carteira detalhada",
    documentTitle: "Carteira prioritária",
    tagline: "Renovação e recuperação — exportação gerencial",
    filterSummaryLines,
    generatedMetaLine,
    columns: carteiraColumnDefs(),
    rows,
    footerNote: "Documento confidencial — uso interno.",
  });
}
