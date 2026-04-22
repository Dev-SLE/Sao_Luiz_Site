/**
 * GET /api/bi/comissoes/holerite/export-xlsx — holerite de comissões em XLSX (layout gerencial).
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { requireGerencialComissoesHolerite } from "@/lib/server/gerencialBiAuth";
import { applyGerencialBiScopeToUrl } from "@/lib/server/gerencialBiScope";
import { getCommercialPool } from "@/lib/server/db";
import { selectBiView } from "@/lib/server/biComissoesRead";
import { buildComissoesHoleriteExcelBuffer } from "@/lib/server/buildComissoesHoleriteExcel";
import { BI_COMISSOES_CONFIG } from "@/modules/bi/comissoes/config";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

function resolveKey(sample: Row, keys: readonly string[]): string | null {
  const byL = new Map(Object.keys(sample).map((k) => [k.toLowerCase(), k] as const));
  for (const c of keys) {
    if (byL.has(c.toLowerCase())) return byL.get(c.toLowerCase())!;
  }
  return null;
}

function formatDateFull(v: unknown): string {
  try {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

function summarizeFilters(url: URL): string[] {
  const out: string[] = [];
  const F = BI_COMISSOES_CONFIG.filters;
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  if (from || to) out.push(`Período (referência): ${from ?? "—"} → ${to ?? "—"}`);
  const vend = url.searchParams.getAll(F.vendedor).filter(Boolean);
  if (vend.length) out.push(`Filtro vendedor(es): ${vend.join(", ")}`);
  const tipos = url.searchParams.getAll(F.tipoComissao).filter(Boolean);
  if (tipos.length) out.push(`Tipo(s) comissão: ${tipos.join(", ")}`);
  const tabs = url.searchParams.getAll(F.tabelaNome).filter(Boolean);
  if (tabs.length) out.push(`Tabela(s): ${tabs.join(", ")}`);
  return out;
}

function headerVendedor(rows: Row[]): string {
  if (!rows.length) return "—";
  const k = BI_COMISSOES_CONFIG.filters.vendedor;
  const first = rows[0]![k];
  if (first != null && String(first).trim()) return String(first).trim();
  const alt = ["nome_vendedor", "nm_vendedor", "vendedor"].find((a) => rows[0]![a] != null);
  return alt ? String(rows[0]![alt]).trim() : "—";
}

function emissionSummary(rows: Row[]): string {
  if (!rows.length) return "—";
  const sample = rows[0]!;
  const emDef = BI_COMISSOES_CONFIG.holeriteLineColumns[0];
  const key =
    emDef && "keys" in emDef ? resolveKey(sample, emDef.keys) : resolveKey(sample, ["data_emissao"]);
  if (!key) return "—";
  const parts = rows.map((r) => formatDateFull(r[key])).filter((s) => s !== "—");
  const uniq = [...new Set(parts)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (!uniq.length) return "—";
  if (uniq.length <= 6) return uniq.join(" · ");
  return `${uniq[0]} a ${uniq[uniq.length - 1]} (${uniq.length} datas)`;
}

function safeFilenamePart(s: string): string {
  return s.replace(/[^\d\-a-zA-Z_]/g, "_").slice(0, 40) || "holerite";
}

export async function GET(req: Request) {
  const guard = await requireGerencialComissoesHolerite(req);
  if (guard.denied) return guard.denied;
  try {
    const url = new URL(req.url);
    applyGerencialBiScopeToUrl(url, guard.session, "comissoes");
    const pool = getCommercialPool();
    const { rows } = await selectBiView(pool, "base", url, {
      defaultLimit: 5000,
      maxLimit: 10000,
      hardLimit: 15000,
    });

    const buffer = await buildComissoesHoleriteExcelBuffer({
      rows: rows as Row[],
      filterSummaryLines: summarizeFilters(url),
      generatedAt: new Date(),
      vendedorHeader: headerVendedor(rows as Row[]),
      emissionSummary: emissionSummary(rows as Row[]),
    });

    const from = url.searchParams.get("from")?.slice(0, 10) ?? "";
    const to = url.searchParams.get("to")?.slice(0, 10) ?? "";
    const vend = headerVendedor(rows as Row[]);
    const filename = `Holerite_comissoes_${safeFilenamePart(from)}_${safeFilenamePart(to)}_${safeFilenamePart(vend)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/bi/comissoes/holerite/export-xlsx:", error);
    return NextResponse.json({ error: "Falha ao gerar a planilha do holerite." }, { status: 500 });
  }
}
