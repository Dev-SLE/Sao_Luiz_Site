/**
 * Rotas operacionais — workbook multi-aba: KPIs, rankings, hierarquia, movimentos (drill / CTE).
 */
import ExcelJS from "exceljs";
import { type BrandedExcelColumn, addBrandedSheetToWorkbook } from "@/lib/server/brandedExcelExport";
import type {
  RotasHierarquiaNode,
  RotasOperacionaisDataset,
  RotasOperacionaisKpis,
} from "@/modules/bi/rotasOperacionais/types";

type Row = Record<string, unknown>;

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function summarizeRotasOperacionaisExportFilters(
  url: URL,
  meta: { drill?: { agencia: string; cidade: string; rota: string } | null },
): string[] {
  const lines: string[] = [];
  const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
  const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
  if (from && to) lines.push(`Período: ${from} a ${to}`);
  const ags = url.searchParams.getAll("agencia").filter(Boolean);
  if (ags.length) lines.push(`Agência origem: ${ags.join(", ")}`);
  const cds = url.searchParams.getAll("cidade_destino").filter(Boolean);
  if (cds.length) lines.push(`Cidade destino: ${cds.join(", ")}`);
  const fxs = url.searchParams.getAll("faixa_peso").filter(Boolean);
  if (fxs.length) lines.push(`Faixa de peso: ${fxs.join(", ")}`);
  const ros = url.searchParams.getAll("rota").filter(Boolean);
  if (ros.length) lines.push(`Rota(s): ${ros.join(", ")}`);
  if (meta.drill) {
    lines.push(
      `Exportação focada (drill): ${meta.drill.agencia} → ${meta.drill.cidade} → rota «${meta.drill.rota}» (aba Movimentos filtrada).`,
    );
  }
  return lines.length ? lines : ["Sem filtros adicionais (período padrão)."];
}

function colsKpis(): BrandedExcelColumn[] {
  return [
    { key: "indicador", label: "Indicador", width: 36, format: "text" },
    { key: "valor", label: "Valor", width: 22, format: "text" },
  ];
}

function kpisToRows(k: RotasOperacionaisKpis): Row[] {
  return [
    { indicador: "Faturamento total", valor: k.faturamento_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
    { indicador: "Ticket médio", valor: k.ticket_medio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
    { indicador: "Total CTEs rotas", valor: String(Math.round(k.total_ctes)) },
    { indicador: "Peso total rotas (kg)", valor: String(Math.round(k.peso_total)) },
    { indicador: "Total volumes rotas", valor: String(Math.round(k.volumes_total)) },
    { indicador: "Peso médio por CTE (kg)", valor: k.peso_medio_por_cte.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    { indicador: "Volumes por CTE", valor: k.volumes_por_cte.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    { indicador: "Faturamento por kg (R$/kg)", valor: k.faturamento_por_kg.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
  ];
}

function colsRankingAg(): BrandedExcelColumn[] {
  return [
    { key: "agencia_origem", label: "Agência origem", width: 28, format: "text" },
    { key: "faturamento_total", label: "Faturamento", width: 16, format: "currency" },
    { key: "total_ctes", label: "CTEs", width: 12, format: "integer" },
  ];
}

function colsRankingCid(): BrandedExcelColumn[] {
  return [
    { key: "cidade_destino", label: "Cidade destino", width: 32, format: "text" },
    { key: "faturamento_total", label: "Faturamento", width: 16, format: "currency" },
    { key: "total_ctes", label: "CTEs", width: 12, format: "integer" },
    { key: "peso_total", label: "Peso (kg)", width: 12, format: "integer" },
    { key: "volumes_total", label: "Volumes", width: 12, format: "integer" },
  ];
}

function colsRankingRota(): BrandedExcelColumn[] {
  return [
    { key: "rota", label: "Rota", width: 28, format: "text" },
    { key: "faturamento", label: "Faturamento", width: 16, format: "currency" },
    { key: "ticket", label: "Ticket médio", width: 14, format: "currency" },
    { key: "volume", label: "Volumes", width: 12, format: "integer" },
    { key: "total_ctes", label: "CTEs", width: 12, format: "integer" },
  ];
}

function colsFaixa(): BrandedExcelColumn[] {
  return [
    { key: "faixa_peso", label: "Faixa de peso", width: 22, format: "text" },
    { key: "total_ctes", label: "CTEs", width: 12, format: "integer" },
    { key: "faturamento_total", label: "Faturamento", width: 16, format: "currency" },
    { key: "peso_total", label: "Peso (kg)", width: 12, format: "integer" },
  ];
}

function colsHierarquia(): BrandedExcelColumn[] {
  return [
    { key: "nivel", label: "Nível", width: 10, format: "integer" },
    { key: "agencia_origem", label: "Agência origem", width: 26, format: "text" },
    { key: "cidade_destino", label: "Cidade destino", width: 26, format: "text" },
    { key: "rota", label: "Rota", width: 22, format: "text" },
    { key: "faturamento_total", label: "Faturamento", width: 16, format: "currency" },
    { key: "peso_total", label: "Peso (kg)", width: 12, format: "integer" },
    { key: "ticket_medio", label: "Ticket médio", width: 14, format: "currency" },
    { key: "total_ctes", label: "CTEs", width: 10, format: "integer" },
    { key: "volumes_total", label: "Volumes", width: 10, format: "integer" },
    { key: "faixa_peso", label: "Faixa predominante", width: 22, format: "text" },
  ];
}

function hierarchyToRows(nodes: RotasHierarquiaNode[]): Row[] {
  return nodes.map((n) => ({
    nivel: n.nivel,
    agencia_origem: n.agencia_origem,
    cidade_destino: n.cidade_destino ?? "",
    rota: n.rota ?? "",
    faturamento_total: n.faturamento_total,
    peso_total: Math.round(n.peso_total),
    ticket_medio: n.ticket_medio,
    total_ctes: Math.round(n.total_ctes),
    volumes_total: Math.round(n.volumes_total),
    faixa_peso: n.faixa_peso ?? "",
  }));
}

function colsMovimentos(): BrandedExcelColumn[] {
  return [
    { key: "id_unico", label: "CTE (id)", width: 22, format: "text" },
    { key: "data_referencia", label: "Emissão", width: 12, format: "date" },
    { key: "agencia_origem", label: "Agência origem", width: 24, format: "text" },
    { key: "cidade_destino", label: "Cidade destino", width: 26, format: "text" },
    { key: "rota", label: "Rota", width: 20, format: "text" },
    { key: "faixa_peso", label: "Faixa peso", width: 18, format: "text" },
    { key: "volumes", label: "Volumes", width: 10, format: "integer" },
    { key: "peso", label: "Peso (kg)", width: 12, format: "integer" },
    { key: "valor_total", label: "Valor total", width: 16, format: "currency" },
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
      cidade_destino: String(r.cidade_destino ?? ""),
      rota: String(r.rota ?? ""),
      faixa_peso: String(r.faixa_peso ?? ""),
      volumes: Math.round(toNum(r.volumes)),
      peso: Math.round(toNum(r.peso)),
      valor_total: toNum(r.valor_total),
    };
  });
}

export async function buildRotasOperacionaisExcelBuffer(
  dataset: RotasOperacionaisDataset,
  movimentosRaw: Record<string, unknown>[],
  url: URL,
  meta: { truncated: boolean; drill: { agencia: string; cidade: string; rota: string } | null },
): Promise<Buffer> {
  const filterLines = summarizeRotasOperacionaisExportFilters(url, { drill: meta.drill });
  const now = new Date().toLocaleString("pt-BR");
  const movRows = mapMovimentoRows(movimentosRaw);
  const footerMov = [
    "Documento confidencial — uso interno.",
    meta.truncated
      ? `Atenção: a aba «Movimentos CTE» foi truncada em ${movRows.length.toLocaleString("pt-BR")} linhas (limite de exportação).`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wb = new ExcelJS.Workbook();
  wb.creator = "São Luiz Express — Operação (BI)";
  wb.created = new Date();

  addBrandedSheetToWorkbook(wb, {
    sheetName: "KPIs",
    documentTitle: "Rotas operacionais",
    tagline: "Indicadores consolidados do período (mesmos valores da tela)",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}`,
    columns: colsKpis(),
    rows: kpisToRows(dataset.kpis),
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Ranking agências",
    documentTitle: "Rotas operacionais",
    tagline: "Faturamento por agência de origem (coleta)",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${dataset.rankingAgencias.length} linha(s)`,
    columns: colsRankingAg(),
    rows: dataset.rankingAgencias as unknown as Row[],
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Ranking cidades",
    documentTitle: "Rotas operacionais",
    tagline: "Destinos com maior faturamento no período",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${dataset.rankingCidades.length} linha(s)`,
    columns: colsRankingCid(),
    rows: dataset.rankingCidades.map((c) => ({
      ...c,
      peso_total: Math.round(c.peso_total),
      volumes_total: Math.round(c.volumes_total),
    })) as Row[],
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Ranking rotas",
    documentTitle: "Rotas operacionais",
    tagline: "Rotas mais relevantes (faturamento / ticket / volume)",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${dataset.rankingRotas.length} linha(s)`,
    columns: colsRankingRota(),
    rows: dataset.rankingRotas.map((r) => ({
      ...r,
      volume: Math.round(r.volume),
      total_ctes: Math.round(r.total_ctes),
    })) as Row[],
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Faixa de peso",
    documentTitle: "Rotas operacionais",
    tagline: "Mix operacional por faixa de peso",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${dataset.faixaPeso.length} linha(s)`,
    columns: colsFaixa(),
    rows: dataset.faixaPeso.map((f) => ({
      ...f,
      total_ctes: Math.round(f.total_ctes),
      peso_total: Math.round(f.peso_total),
    })) as Row[],
    footerNote: "Documento confidencial — uso interno.",
  });

  const hierRows = hierarchyToRows(dataset.hierarchy);
  addBrandedSheetToWorkbook(wb, {
    sheetName: "Hierarquia",
    documentTitle: "Rotas operacionais",
    tagline: "Agência → cidade destino → rota (mesma lógica da tabela expansível)",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${hierRows.length} linha(s)`,
    columns: colsHierarquia(),
    rows: hierRows,
    footerNote: "Documento confidencial — uso interno.",
  });

  addBrandedSheetToWorkbook(wb, {
    sheetName: "Movimentos CTE",
    documentTitle: "Rotas operacionais",
    tagline: meta.drill
      ? "Detalhe ao nível de cada CTE — apenas a combinação agência / cidade / rota do drill"
      : "Detalhe ao nível de cada CTE — todas as operações do período com os filtros aplicados",
    filterSummaryLines: filterLines,
    generatedMetaLine: `Gerado em ${now}  ·  ${movRows.length} movimento(s)`,
    columns: colsMovimentos(),
    rows: movRows,
    footerNote: footerMov,
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
