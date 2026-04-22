'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, ChevronDown, Download, Loader2 } from 'lucide-react';
import {
  BI_METAS_PERFORMANCE_CONFIG,
  METAS_KPI_SLOTS,
  METAS_TABELA_COLUNAS,
} from '@/modules/bi/metasPerformance/config';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';

type Row = Record<string, unknown>;

const NAVY = '#1e3a5f';
const TEAL = '#0d9488';
const SLATE = '#94a3b8';

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

/** Razão vinda do BI (ex.: 0,87 ou 1,12) → percentual. */
function formatBiRatioAsPercent(raw: unknown): string {
  const n = toNum(raw);
  const pct = n * 100;
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

function formatKpiValue(format: 'currency' | 'percent' | 'integer', raw: unknown): string {
  if (format === 'integer') return String(Math.round(toNum(raw)));
  if (format === 'percent') return formatBiRatioAsPercent(raw);
  return formatBrl(toNum(raw));
}

function AgenciaMultiSelect({
  options,
  selectedValues,
  onToggle,
  onClear,
}: {
  options: { label: string; value: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const summary = selectedValues.length ? `${selectedValues.length} selecionada(s)` : 'Todas';
  return (
    <details className="group relative min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Agência</span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Sem agências no mês de referência</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="rounded border-slate-300 text-sl-navy focus:ring-sl-navy/30"
              />
              <span className="truncate" title={opt.label}>
                {opt.label}
              </span>
            </label>
          ))
        )}
        <div className="border-t border-slate-100 px-3 pt-2">
          <button
            type="button"
            className="text-xs font-semibold text-sl-navy underline"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            Limpar seleção
          </button>
        </div>
      </div>
    </details>
  );
}

export function BiMetasPerformanceDashboard() {
  const defaultFrom = useMemo(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), []);
  const defaultTo = useMemo(
    () => format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    [],
  );

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [selAgencias, setSelAgencias] = useState<string[]>([]);
  const [agKey, setAgKey] = useState<string>(BI_METAS_PERFORMANCE_CONFIG.filters.agencia);
  const [agOpts, setAgOpts] = useState<{ label: string; value: string }[]>([]);

  const [kpis, setKpis] = useState<Row | null>(null);
  const [tableRows, setTableRows] = useState<Row[]>([]);
  const [dashMeta, setDashMeta] = useState<{
    from: string;
    to: string;
    mesReferencia: string;
    corte: string | null;
    diasUteisPassados: number;
    diasUteisMes: number;
    diasRestantes: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const queryBase = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const ak = agKey || BI_METAS_PERFORMANCE_CONFIG.filters.agencia;
    for (const v of selAgencias) if (v) q.append(ak, v);
    return q.toString();
  }, [from, to, selAgencias, agKey]);

  const loadFacets = useCallback(async () => {
    const q = queryBase || `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    try {
      const j = await biGetJson<{
        agencias?: unknown[];
        keys?: { agencia?: string };
      }>(`/api/bi/metas-performance/facet-options?${q}`);
      const arr = (Array.isArray(j.agencias) ? j.agencias : []) as unknown[];
      setAgOpts(
        arr
          .filter((x: unknown) => x && typeof x === 'object' && 'value' in (x as object))
          .map((x: unknown) => {
            const o = x as { label?: unknown; value?: unknown };
            return {
              label: String(o.label ?? '').trim(),
              value: String(o.value ?? '').trim(),
            };
          })
          .filter((x: { value: string }) => x.value.length > 0),
      );
      setAgKey(typeof j.keys?.agencia === 'string' ? j.keys.agencia : BI_METAS_PERFORMANCE_CONFIG.filters.agencia);
    } catch {
      /* facet-options não-ok */
    }
  }, [queryBase, from, to]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = queryBase ? `?${queryBase}` : '';
      const j = await biGetJson<{
        kpis?: unknown[];
        rows?: unknown[];
        meta?: Record<string, unknown>;
        error?: string;
      }>(`/api/bi/metas-performance/table${qs}`);
      const kArr = Array.isArray(j.kpis) ? (j.kpis as Row[]) : [];
      setKpis(kArr[0] ?? null);
      setTableRows(Array.isArray(j.rows) ? (j.rows as Row[]) : []);
      const m = j.meta;
      if (m && typeof m === 'object') {
        setDashMeta({
          from: String((m as { from?: string }).from ?? ''),
          to: String((m as { to?: string }).to ?? ''),
          mesReferencia: String((m as { mesReferencia?: string }).mesReferencia ?? ''),
          corte: (m as { corte?: string | null }).corte ?? null,
          diasUteisPassados: Number((m as { diasUteisPassados?: number }).diasUteisPassados ?? 0),
          diasUteisMes: Number((m as { diasUteisMes?: number }).diasUteisMes ?? 0),
          diasRestantes: Number((m as { diasRestantes?: number }).diasRestantes ?? 0),
        });
      } else setDashMeta(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [queryBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportXlsx = async () => {
    setExporting(true);
    setError(null);
    try {
      const qs = queryBase ? `?${queryBase}` : '';
      const res = await fetch(`/api/bi/metas-performance/export-table${qs}`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(String((j as { error?: string })?.error || res.statusText));
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? 'Metas_performance.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const rankingRows = useMemo(() => {
    return [...tableRows].sort((a, b) => {
      const ra = toNum(a.realizado) / Math.max(toNum(a.meta_mes), 1e-9);
      const rb = toNum(b.realizado) / Math.max(toNum(b.meta_mes), 1e-9);
      return rb - ra;
    });
  }, [tableRows]);

  const donutData = useMemo(() => {
    const meta = toNum(kpis?.meta_oficial);
    const real = toNum(kpis?.ja_vendido);
    const rest = Math.max(0, meta - real);
    return [
      { name: 'Realizado', value: real, fill: TEAL },
      { name: 'Falta para a meta', value: rest < 0.0001 && meta > 0 ? 0.0001 : rest, fill: '#e2e8f0' },
    ];
  }, [kpis]);

  const barChartData = useMemo(() => {
    return rankingRows.slice(0, 16).map((r) => ({
      agencia: String(r.agencia ?? '').slice(0, 18),
      Realizado: toNum(r.realizado),
      Projeção: toNum(r.projecao_smart),
      Meta: toNum(r.meta_mes),
    }));
  }, [rankingRows]);

  const mesLabel = useMemo(() => {
    if (!dashMeta?.mesReferencia) return '';
    try {
      return format(parse(dashMeta.mesReferencia, 'yyyy-MM-dd', new Date()), 'MMMM yyyy', { locale: ptBR });
    } catch {
      return dashMeta.mesReferencia;
    }
  }, [dashMeta?.mesReferencia]);

  const corteLabel = dashMeta?.corte
    ? format(parse(dashMeta.corte, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ptBR })
    : '—';

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-white to-slate-50/90 pb-16 pt-2">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 md:px-6">
        <header className="rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white via-slate-50/80 to-white px-5 py-6 shadow-[0_12px_40px_rgba(30,58,95,0.1)] md:px-8 md:py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sl-red">Gerencial</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">Metas & performance</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Monitoramento por agência: meta do mês, faturamento no período, projeção de fechamento e comparação com o
            ano anterior.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Meta do mês (referência): <span className="font-semibold capitalize text-slate-800">{mesLabel}</span>
            <span className="mx-2 text-slate-300">·</span>
            Corte da projeção: <span className="font-semibold text-slate-800">{corteLabel}</span>
            <span className="mx-2 text-slate-300">·</span>
            Úteis no período até o corte:{' '}
            <span className="font-semibold text-slate-800">{dashMeta?.diasUteisPassados ?? '—'}</span> · Úteis no mês:{' '}
            <span className="font-semibold text-slate-800">{dashMeta?.diasUteisMes ?? '—'}</span> · Úteis restantes no
            mês: <span className="font-semibold text-slate-800">{dashMeta?.diasRestantes ?? '—'}</span>
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm md:px-5 md:py-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filtros</p>
          <div className="mt-3 flex flex-wrap items-end gap-3 md:gap-4">
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Período — início</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-sl-navy/20 focus:border-sl-navy/40 focus:ring-2"
              />
            </label>
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Período — fim</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-sl-navy/20 focus:border-sl-navy/40 focus:ring-2"
              />
            </label>
            <AgenciaMultiSelect options={agOpts} selectedValues={selAgencias} onToggle={(v) => {
              setSelAgencias((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
            }} onClear={() => setSelAgencias([])} />
          </div>
        </section>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-600">
            <Loader2 className="size-9 animate-spin text-sl-navy" />
            <span className="text-sm font-medium">Carregando metas…</span>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {METAS_KPI_SLOTS.map((slot, idx) => (
                <div
                  key={slot.key}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm ring-1 ring-slate-100"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: idx === 0 ? NAVY : idx === 1 ? TEAL : idx === 2 ? '#6366f1' : '#64748b',
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{slot.label}</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-slate-900 md:text-xl">
                    {formatKpiValue(slot.format, kpis?.[slot.key])}
                  </p>
                </div>
              ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Progresso da meta global</h2>
                <p className="mt-1 text-xs text-slate-500">Realizado no período frente à meta oficial consolidada.</p>
                <div className="mx-auto mt-4 h-[260px] w-full max-w-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={68} outerRadius={96} paddingAngle={2} dataKey="value">
                        {donutData.map((e, i) => (
                          <Cell key={e.name} fill={e.fill} stroke={i === 1 ? '#cbd5e1' : 'none'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBrl(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-center gap-6 text-xs text-slate-600">
                  <span>
                    <span className="inline-block size-2.5 rounded-full bg-teal-600 align-middle" /> Realizado{' '}
                    {formatBrl(toNum(kpis?.ja_vendido))}
                  </span>
                  <span>
                    <span className="inline-block size-2.5 rounded-full bg-slate-200 align-middle" /> Falta{' '}
                    {formatBrl(Math.max(0, toNum(kpis?.meta_oficial) - toNum(kpis?.ja_vendido)))}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Ranking (real vs meta)</h2>
                <p className="mt-1 text-xs text-slate-500">Até 16 agências — realizado, projeção e meta do mês.</p>
                <div className="mt-4 h-[300px] w-full min-w-0">
                  {barChartData.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-400">Sem dados para o período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ left: 4, right: 8, top: 8, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="agencia" angle={-28} textAnchor="end" height={70} tick={{ fontSize: 10, fill: '#475569' }} />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke={SLATE} />
                        <Tooltip formatter={(v: number) => formatBrl(v)} />
                        <Legend />
                        <Bar dataKey="Realizado" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="Projeção" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="Meta" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Detalhe por agência</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Valores calculados no servidor a partir do faturamento autorizado e das metas do mês.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={exporting || tableRows.length === 0}
                  onClick={() => void exportXlsx()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sl-navy/25 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={2} />}
                  Exportar planilha (XLSX)
                </button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-900 to-slate-800 text-left text-white">
                      {METAS_TABELA_COLUNAS.map((c) => (
                        <th key={c.key} className="whitespace-nowrap px-3 py-3 font-semibold">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={METAS_TABELA_COLUNAS.length} className="px-4 py-10 text-center text-slate-400">
                          Nenhuma linha para os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((r) => (
                        <tr key={String(r.agencia_normalizada)} className="border-b border-slate-100 odd:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{String(r.agencia ?? '')}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatBrl(toNum(r.meta_mes))}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatBrl(toNum(r.realizado))}</td>
                          <td className="px-3 py-2.5 font-semibold text-indigo-800">{formatBiRatioAsPercent(r.pct_projetado)}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatBrl(toNum(r.projecao_smart))}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatBrl(toNum(r.realizado_ly))}</td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {r.pct_crescimento == null || String(r.pct_crescimento) === ''
                              ? '—'
                              : formatBiRatioAsPercent(r.pct_crescimento)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{formatBrl(toNum(r.meta_diaria))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
