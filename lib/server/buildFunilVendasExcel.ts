/**
 * Planilha Performance de vendas — usa o layout padrão `brandedExcelExport`.
 */
import type { Pool } from "pg";
import {
  type BrandedExcelColumn,
  buildBrandedExcelBuffer,
} from "@/lib/server/brandedExcelExport";
import { BI_FUNIL_VENDAS_CONFIG, FUNIL_TABELA_COLUNAS } from "@/modules/bi/funilVendas/config";

type Row = Record<string, unknown>;

export function summarizeFunilExportFilters(url: URL): string[] {
  const lines: string[] = [];
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to) lines.push(`Período: ${from} a ${to}`);
  else if (from) lines.push(`Período a partir de: ${from}`);
  else if (to) lines.push(`Período até: ${to}`);

  const F = BI_FUNIL_VENDAS_CONFIG.filters;
  const vs = url.searchParams.getAll(F.vendedor).filter(Boolean);
  if (vs.length) lines.push(`Vendedor(es): ${vs.join(", ")}`);
  const ss = url.searchParams.getAll(F.statusFunil).filter(Boolean);
  if (ss.length) lines.push(`Status: ${ss.join(", ")}`);
  const ps = url.searchParams.getAll(F.cotIdPesquisaSistema).filter(Boolean);
  if (ps.length) lines.push(`Orçamento: ${ps.join(", ")}`);
  const cs = url.searchParams.getAll(F.cteSerie).filter(Boolean);
  if (cs.length) lines.push(`Série CT-e: ${cs.join(", ")}`);
  const q = url.searchParams.get("search")?.trim();
  if (q) lines.push(`Busca na tabela: ${q}`);
  return lines;
}

function funilColumnDefs(): BrandedExcelColumn[] {
  const widths: Record<string, number> = {
    cot_id_pesquisa_sistema: 22,
    cte_serie: 14,
    numero_cte: 12,
    data_cotacao: 20,
    cliente: 38,
    vendedor: 22,
    nome_tabela: 32,
    valor_cotacao: 18,
    status: 22,
  };
  const formats: Partial<Record<string, BrandedExcelColumn["format"]>> = {
    data_cotacao: "datetime",
    valor_cotacao: "currency",
  };
  return FUNIL_TABELA_COLUNAS.map((c) => ({
    key: c.key,
    label: c.label,
    width: widths[c.key] ?? 16,
    format: formats[c.key] ?? "text",
  }));
}

export async function buildFunilVendasExcelBuffer(_pool: Pool, rows: Row[], url: URL): Promise<Buffer> {
  const filterSummaryLines = summarizeFunilExportFilters(url);
  const generatedMetaLine = `Gerado em ${new Date().toLocaleString("pt-BR")}  ·  ${rows.length} linha(s)`;

  return buildBrandedExcelBuffer({
    sheetName: "Cotações",
    documentTitle: "Performance de Vendas",
    tagline: "Cotações do funil — exportação gerencial",
    filterSummaryLines,
    generatedMetaLine,
    columns: funilColumnDefs(),
    rows,
    footerNote: "Documento confidencial — uso interno.",
  });
}
