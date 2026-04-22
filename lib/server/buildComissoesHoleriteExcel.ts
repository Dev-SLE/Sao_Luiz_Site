/**
 * Holerite de comissões — export XLSX no layout `brandedExcelExport`.
 */
import { BI_COMISSOES_CONFIG } from "@/modules/bi/comissoes/config";
import {
  type BrandedExcelColumn,
  type BrandedExcelColumnFormat,
  buildBrandedExcelBuffer,
} from "@/lib/server/brandedExcelExport";

type Row = Record<string, unknown>;
type LineDef = (typeof BI_COMISSOES_CONFIG.holeriteLineColumns)[number];

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function resolveKey(sample: Row, keys: readonly string[]): string | null {
  const byL = new Map(Object.keys(sample).map((k) => [k.toLowerCase(), k] as const));
  for (const c of keys) {
    if (byL.has(c.toLowerCase())) return byL.get(c.toLowerCase())!;
  }
  return null;
}

function activeLineDefs(sample: Row | null): LineDef[] {
  if (!sample) return [];
  const out: LineDef[] = [];
  for (const def of BI_COMISSOES_CONFIG.holeriteLineColumns) {
    if (def.format === "nfSerie") {
      if (resolveKey(sample, def.nfKeys) || resolveKey(sample, def.serieKeys)) out.push(def);
      continue;
    }
    if (resolveKey(sample, def.keys)) out.push(def);
  }
  return out;
}

function extractCell(def: LineDef, r: Row): unknown {
  if (def.format === "nfSerie") {
    const nk = resolveKey(r, def.nfKeys);
    const sk = resolveKey(r, def.serieKeys);
    const nf = nk ? String(r[nk] ?? "").trim() : "";
    const se = sk ? String(r[sk] ?? "").trim() : "";
    if (nf && se) return `${nf} / ${se}`;
    return nf || se || "";
  }
  const k = resolveKey(r, def.keys);
  if (!k) return "";
  if (def.format === "dateFull") return r[k];
  if (def.format === "brl") return toNum(r[k]);
  if (def.format === "percent") {
    const n = toNum(r[k]);
    if (r[k] === null || r[k] === undefined || r[k] === "") return "";
    if (n > 0 && n <= 1 && !Number.isInteger(n)) {
      return `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
    }
    if (n > 1 && n <= 100) {
      return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
    }
    if (n > 100) {
      return `${(n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
    }
    return `${n}%`;
  }
  const v = r[k];
  if (v === null || v === undefined) return "";
  return String(v);
}

function excelFormatFor(def: LineDef): BrandedExcelColumnFormat {
  if (def.format === "dateFull") return "date";
  if (def.format === "brl") return "currency";
  return "text";
}

export async function buildComissoesHoleriteExcelBuffer(params: {
  rows: Row[];
  filterSummaryLines: string[];
  generatedAt: Date;
  vendedorHeader: string;
  emissionSummary: string;
}): Promise<Buffer> {
  const sample = params.rows[0] ?? null;
  const defs = activeLineDefs(sample);
  const columns: BrandedExcelColumn[] = defs.map((def, i) => ({
    key: `c_${i}`,
    label: def.label,
    width: def.label.length > 18 ? 22 : 16,
    format: excelFormatFor(def),
  }));

  const brandedRows = params.rows.map((r) => {
    const ob: Record<string, unknown> = {};
    defs.forEach((def, i) => {
      ob[`c_${i}`] = extractCell(def, r);
    });
    return ob;
  });

  const metaLine = `Gerado em ${params.generatedAt.toLocaleString("pt-BR")} · ${params.rows.length} linha(s)`;

  return buildBrandedExcelBuffer({
    sheetName: "Holerite comissões",
    documentTitle: "Holerite de comissões",
    tagline: "Documento holerite_comissoes",
    filterSummaryLines: [
      `Vendedor: ${params.vendedorHeader}`,
      `Data(s) de emissão: ${params.emissionSummary}`,
      ...params.filterSummaryLines,
    ],
    generatedMetaLine: metaLine,
    columns,
    rows: brandedRows,
    footerNote: "Documento confidencial — uso interno.",
    workbookCreator: "São Luiz Express — Gerencial · Comissões",
  });
}
