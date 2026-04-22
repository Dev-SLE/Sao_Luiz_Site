/**
 * Desempenho agências — duas abas: resumo por agência (tabela da tela) + movimentos (grão drill / CTE).
 */
import ExcelJS from "exceljs";
import {
  type BrandedExcelColumn,
  addBrandedSheetToWorkbook,
} from "@/lib/server/brandedExcelExport";
import type { DesempenhoAgenciasTableRow } from "@/modules/bi/desempenhoAgencias/types";

type Row = Record<string, unknown>;

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function yn(v: unknown): string {
  return toNum(v) !== 0 ? "Sim" : "Não";
}

export function summarizeDesempenhoAgenciasExportFilters(url: URL, agenciaFoco?: string): string[] {
  const lines: string[] = [];
  const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
  const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
  if (from && to) lines.push(`Período: ${from} a ${to}`);
  const ags = url.searchParams.getAll("agencia").filter(Boolean);
  if (ags.length) lines.push(`Filtro agência (malha): ${ags.join(", ")}`);
  const rotas = url.searchParams.getAll("rota").filter(Boolean);
  if (rotas.length) lines.push(`Rota(s): ${rotas.join(", ")}`);
  const tipos = url.searchParams.getAll("tipo_frete").filter(Boolean);
  if (tipos.length) lines.push(`Tipo(s) de frete: ${tipos.join(", ")}`);
  if (agenciaFoco) lines.push(`Detalhe movimentos: apenas agência «${agenciaFoco}» (origem ou destino)`);
  return lines.length ? lines : ["Sem filtros adicionais (período padrão)."];
}

function colsResumo(): BrandedExcelColumn[] {
  return [
    { key: "agencia", label: "Agência", width: 28, format: "text" },
    { key: "total_ctes_origem", label: "CTEs origem", width: 14, format: "integer" },
    { key: "total_ctes_destino", label: "CTEs destino", width: 14, format: "integer" },
    { key: "total_volumes_origem", label: "Vol. origem", width: 12, format: "integer" },
    { key: "total_volumes_destino", label: "Vol. destino", width: 12, format: "integer" },
    { key: "peso_total_origem", label: "Peso origem (kg)", width: 14, format: "integer" },
    { key: "faturamento_origem", label: "Faturamento origem", width: 18, format: "currency" },
    { key: "qtd_coletas", label: "Qtd coletas", width: 12, format: "integer" },
    { key: "qtd_entregas", label: "Qtd entregas", width: 12, format: "integer" },
    { key: "qtd_manifestos", label: "Qtd manifestos", width: 14, format: "integer" },
    { key: "saldo_ctes", label: "Saldo CTEs", width: 12, format: "integer" },
    { key: "saldo_volumes", label: "Saldo volumes", width: 12, format: "integer" },
    { key: "volumes_por_cte", label: "Vol./CTE", width: 12, format: "text" },
    { key: "peso_por_cte", label: "Peso/CTE", width: 12, format: "text" },
    { key: "ticket_por_cte", label: "Ticket/CTE", width: 14, format: "currency" },
  ];
}

function tableToRows(rows: DesempenhoAgenciasTableRow[]): Row[] {
  return rows.map((t) => ({
    agencia: t.agencia,
    total_ctes_origem: t.total_ctes_origem,
    total_ctes_destino: t.total_ctes_destino,
    total_volumes_origem: t.total_volumes_origem,
    total_volumes_destino: t.total_volumes_destino,
    peso_total_origem: Math.round(t.peso_total_origem),
    faturamento_origem: t.faturamento_origem,
    qtd_coletas: t.qtd_coletas,
    qtd_entregas: t.qtd_entregas,
    qtd_manifestos: t.qtd_manifestos,
    saldo_ctes: t.saldo_ctes,
    saldo_volumes: t.saldo_volumes,
    volumes_por_cte: (t.volumes_por_cte ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    peso_por_cte: (t.peso_por_cte ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ticket_por_cte: t.ticket_por_cte,
  }));
}

function colsMovimentos(): BrandedExcelColumn[] {
  return [
    { key: "id_unico", label: "CTE (id)", width: 22, format: "text" },
    { key: "data_referencia", label: "Emissão", width: 12, format: "date" },
    { key: "agencia_origem", label: "Agência origem", width: 24, format: "text" },
    { key: "agencia_destino", label: "Agência destino", width: 24, format: "text" },
    { key: "rota", label: "Rota", width: 18, format: "text" },
    { key: "tipo_frete", label: "Tipo frete", width: 14, format: "text" },
    { key: "volumes", label: "Volumes", width: 10, format: "integer" },
    { key: "peso", label: "Peso (kg)", width: 12, format: "integer" },
    { key: "valor_total", label: "Valor total", width: 16, format: "currency" },
    { key: "com_coleta", label: "Com coleta", width: 12, format: "text" },
    { key: "com_entrega", label: "Com entrega", width: 12, format: "text" },
    { key: "com_manifesto", label: "Com manifesto", width: 14, format: "text" },
  ];
}

function mapMovimentoRows(raw: Record<string, unknown>[]): Row[] {
  return raw.map((r) => {
    const dr = r.data_referencia;
    const dataStr =
      dr instanceof Date
        ? dr.toISOString().slice(0, 10)
        : String(dr ?? "")
            .slice(0, 10)
            .replace(/T.*/, "");
    return {
      id_unico: String(r.id_unico ?? ""),
      data_referencia: dataStr,
      agencia_origem: String(r.agencia_origem ?? ""),
      agencia_destino: String(r.agencia_destino ?? ""),
      rota: String(r.rota ?? ""),
      tipo_frete: String(r.tipo_frete ?? ""),
      volumes: Math.round(toNum(r.volumes)),
      peso: Math.round(toNum(r.peso)),
      valor_total: toNum(r.valor_total),
      com_coleta: yn(r.flg_coleta),
      com_entrega: yn(r.flg_entrega),
      com_manifesto: yn(r.flg_manifesto),
    };
  });
}

export async function buildDesempenhoAgenciasExcelBuffer(
  table: DesempenhoAgenciasTableRow[],
  movimentosRaw: Record<string, unknown>[],
  url: URL,
  meta: { truncated: boolean },
): Promise<Buffer> {
  const agenciaFoco = (url.searchParams.get("agencia_foco") || "").trim() || undefined;
  const filterLines = summarizeDesempenhoAgenciasExportFilters(url, agenciaFoco);
  const resumoRows = tableToRows(table);
  const movRows = mapMovimentoRows(movimentosRaw);
  const now = new Date().toLocaleString("pt-BR");

  const footerMov = [
    "Documento confidencial — uso interno.",
    meta.truncated
      ? `Atenção: a aba «Movimentos» foi truncada em ${movRows.length.toLocaleString("pt-BR")} linhas (limite de exportação).`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wb = new ExcelJS.Workbook();
  wb.creator = "São Luiz Express — Operação (BI)";
  wb.created = new Date();

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Resumo agências",
    documentTitle: "Desempenho de agências",
    tagline: "Painel por agência — mesmo agregado da tela na aplicação",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${resumoRows.length} linha(s)`,
    columns: colsResumo(),
    rows: resumoRows,
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Movimentos",
    documentTitle: "Desempenho de agências",
    tagline: "Detalhe ao nível de cada CTE (drill) — operações autorizadas no período e filtros aplicados",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${movRows.length} movimento(s)`,
    columns: colsMovimentos(),
    rows: movRows,
    footerNote: footerMov,
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
