'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { AlertCircle, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { BI_COMISSOES_CONFIG } from '@/modules/bi/comissoes/config';
import { gerencialPath } from '@/modules/gerencial/routes';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';

type Row = Record<string, unknown>;

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v ?? '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n);
}

function formatDateFull(v: unknown): string {
  try {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

function formatPctComissao(v: unknown): string {
  const n = toNum(v);
  if (v === null || v === undefined || v === '') return '—';
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0%';
  if (n > 0 && n <= 1 && !Number.isInteger(n)) {
    return `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }
  if (n > 1 && n <= 100) {
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }
  if (n > 100) {
    return `${(n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }
  return `${n}%`;
}

function resolveKey(sample: Row, keys: readonly string[]): string | null {
  const byL = new Map(Object.keys(sample).map((k) => [k.toLowerCase(), k] as const));
  for (const c of keys) {
    if (byL.has(c.toLowerCase())) return byL.get(c.toLowerCase())!;
  }
  return null;
}

type HoleriteCol = { label: string; render: (r: Row) => string };

function buildHoleriteColumns(sample: Row | null): HoleriteCol[] {
  if (!sample) return [];
  const out: HoleriteCol[] = [];
  for (const def of BI_COMISSOES_CONFIG.holeriteLineColumns) {
    if (def.format === 'nfSerie') {
      const nk = resolveKey(sample, def.nfKeys);
      const sk = resolveKey(sample, def.serieKeys);
      if (!nk && !sk) continue;
      out.push({
        label: def.label,
        render: (r: Row) => {
          const nf = nk ? String(r[nk] ?? '').trim() : '';
          const se = sk ? String(r[sk] ?? '').trim() : '';
          if (nf && se) return `${nf} / ${se}`;
          return nf || se || '—';
        },
      });
      continue;
    }
    const k = resolveKey(sample, def.keys);
    if (!k) continue;
    if (def.format === 'dateFull') {
      out.push({ label: def.label, render: (r: Row) => formatDateFull(r[k]) });
    } else if (def.format === 'brl') {
      out.push({ label: def.label, render: (r: Row) => formatBrl(toNum(r[k])) });
    } else if (def.format === 'percent') {
      out.push({ label: def.label, render: (r: Row) => formatPctComissao(r[k]) });
    } else {
      out.push({
        label: def.label,
        render: (r: Row) => {
          const v = r[k];
          if (v === null || v === undefined) return '—';
          return String(v);
        },
      });
    }
  }
  return out;
}

export function ComissoesHoleriteView() {
  const searchParams = useSearchParams();
  const qs = useMemo(() => searchParams.toString(), [searchParams]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = qs ? `/api/bi/comissoes/holerite?${qs}` : '/api/bi/comissoes/holerite';
      const j = await biGetJson<{ rows?: Row[]; error?: string }>(url);
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar holerite');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const cols = useMemo(() => buildHoleriteColumns(rows[0] ?? null), [rows]);

  const headerVendedor = useMemo(() => {
    const k = BI_COMISSOES_CONFIG.filters.vendedor;
    const first = rows[0]?.[k];
    if (first != null && String(first).trim()) return String(first).trim();
    const alt = ['nome_vendedor', 'nm_vendedor', 'vendedor'].find((a) => rows[0]?.[a] != null);
    return alt ? String(rows[0]?.[alt]).trim() : '—';
  }, [rows]);

  const emissionSummary = useMemo(() => {
    if (!rows.length) return '—';
    const sample = rows[0];
    const emDef = BI_COMISSOES_CONFIG.holeriteLineColumns[0];
    const key = emDef && 'keys' in emDef ? resolveKey(sample, emDef.keys) : resolveKey(sample, ['data_emissao']);
    if (!key) return '—';
    const parts = rows.map((r) => formatDateFull(r[key])).filter((s) => s !== '—');
    const uniq = [...new Set(parts)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!uniq.length) return '—';
    if (uniq.length <= 6) return uniq.join(' · ');
    return `${uniq[0]} a ${uniq[uniq.length - 1]} (${uniq.length} datas)`;
  }, [rows]);

  const printHolerite = () => {
    const el = sheetRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const styles = `
      * { box-sizing: border-box; }
      body { font-family: 'Manrope', 'Sora', ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      .holerite-doc { max-width: 960px; margin: 0 auto; }
      .holerite-head { background: linear-gradient(90deg,#1e3a5f,#2a4a7a); color: #fff; padding: 28px 32px; border-radius: 12px 12px 0 0; }
      .holerite-sub { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.85; }
      .holerite-head h1 { margin: 8px 0 0; font-size: 22px; font-weight: 700; }
      .holerite-head p { margin: 10px 0 0; font-size: 14px; }
      .holerite-body { border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; padding: 20px 24px 28px; background: #fff; }
      .holerite-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #f1f5f9; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #1e3a5f !important; font-weight: 700; color: #ffffff !important; border-color: #2a4a7a !important; }
      tbody tr:nth-child(even) td { background: #fafafa; }
      .holerite-foot { margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #94a3b8; text-align: center; }
    `;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Holerite de comissões</title><style>${styles}</style></head><body>${el.outerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const exportExcel = async () => {
    setExporting(true);
    setError(null);
    try {
      const url = qs ? `/api/bi/comissoes/holerite/export-xlsx?${qs}` : '/api/bi/comissoes/holerite/export-xlsx';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(String((j as { error?: string })?.error || res.statusText));
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? 'Holerite_comissoes.xlsx';
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar para Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-slate-100/90 px-3 py-5 sm:px-4 md:px-8 md:py-6">
      <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link
          href={gerencialPath('comissoes')}
          className="text-sm font-semibold text-sl-navy underline-offset-2 hover:underline"
        >
          ← Voltar ao BI de comissões
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || loading || !rows.length}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700/25 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
            Excel
          </button>
          <button
            type="button"
            onClick={printHolerite}
            className="inline-flex items-center gap-2 rounded-xl border border-sl-navy/20 bg-white px-4 py-2.5 text-sm font-bold text-sl-navy shadow-sm transition hover:bg-slate-50"
          >
            <Printer size={18} />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className="mx-auto mb-4 flex max-w-5xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="animate-spin text-sl-navy" size={32} />
          <span className="text-sm text-slate-600">Carregando holerite…</span>
        </div>
      ) : null}

      <div ref={sheetRef} className="holerite-doc mx-auto max-w-5xl min-w-0">
        <header className="holerite-head">
          <p className="holerite-sub">Documento holerite_comissoes</p>
          <h1>Holerite de comissões</h1>
          <p>
            Vendedor: <strong>{headerVendedor}</strong>
          </p>
          <p>
            Data(s) de emissão: <strong>{emissionSummary}</strong>
          </p>
        </header>

        <div className="holerite-body">
          {!loading && !rows.length ? (
            <p className="text-center text-sm text-slate-600">Nenhuma linha no período para os filtros informados.</p>
          ) : null}

          {rows.length > 0 && cols.length > 0 ? (
            <div className="holerite-table-wrap overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full min-w-[min(720px,100%)] text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-[#2a4a7a] bg-gradient-to-r from-[#1e3a5f] to-[#2a4a7a] text-white">
                    <th className="sticky left-0 z-10 bg-[#1e3a5f] px-3 py-2.5 font-bold text-white">#</th>
                    {cols.map((c, ci) => (
                      <th key={`h-${ci}-${c.label}`} className="whitespace-nowrap px-3 py-2.5 font-bold text-white">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50">
                      <td className="sticky left-0 z-[1] bg-inherit px-3 py-2 font-medium text-slate-500">{i + 1}</td>
                      {cols.map((c, ci) => (
                        <td
                          key={`${i}-${ci}-${c.label}`}
                          className="max-w-[220px] whitespace-pre-wrap break-words px-3 py-2 text-slate-800"
                        >
                          {c.render(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <footer className="holerite-foot">
            Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} — uso interno.
          </footer>
        </div>
      </div>
    </div>
  );
}
