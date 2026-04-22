'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import { BI_SPRINT_VENDAS_CONFIG, SPRINT_KPI_SLOTS } from '@/modules/bi/sprintVendas/config';
import { biGetJson, biGetJsonSafe } from '@/modules/gerencial/biApiClientCache';

type Row = Record<string, unknown>;

const NAVY = '#0c4a6e';
const GOLD = '#d97706';
const WIN = '#0d9488';

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

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** O BI devolve razão (venda ÷ meta): 0,42 → 42%; 1,024 → 102,4%. */
function formatBiRatioAsPercent(raw: unknown): string {
  const n = toNum(raw);
  const pct = n * 100;
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

function formatKpiValue(format: 'currency' | 'percent' | 'integer', raw: unknown): string {
  if (format === 'integer') return formatInt(toNum(raw));
  if (format === 'percent') return formatBiRatioAsPercent(raw);
  return formatBrl(toNum(raw));
}

function CollapsibleMultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const summary = selected.length ? `${selected.length} selecionado(s)` : 'Todas';
  return (
    <details className="group relative min-w-[200px] flex-1 rounded-xl border border-amber-200/60 bg-white/90 shadow-sm open:z-30 open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-900/70">{label}</span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Sem opções para este mês</p>
        ) : (
          options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-amber-50/80">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="rounded border-slate-300 text-amber-700 focus:ring-amber-500/30"
              />
              <span className="truncate" title={opt}>
                {opt}
              </span>
            </label>
          ))
        )}
        <div className="border-t border-slate-100 px-3 pt-2">
          <button
            type="button"
            className="text-xs font-semibold text-amber-900 underline"
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

type TabelaRow = {
  vendedor: string;
  semana_mes_ordem: number | null;
  semana_mes_label: string | null;
  meta_semanal_est: unknown;
  venda_auditada_semana: unknown;
  percentual_meta_semana: unknown;
  status_semana: string | null;
};

export function BiSprintVendasDashboard() {
  const defaultMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const [month, setMonth] = useState(defaultMonth);
  const [from, setFrom] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [selVendedores, setSelVendedores] = useState<string[]>([]);
  const [vendKey, setVendKey] = useState<string>(BI_SPRINT_VENDAS_CONFIG.filters.vendedor);
  const [vendOpts, setVendOpts] = useState<string[]>([]);
  const [kpis, setKpis] = useState<Row | null>(null);
  const [kpiMeta, setKpiMeta] = useState<{ mesReferencia: string; refLogica: string | null } | null>(null);
  const [ranking, setRanking] = useState<Row[]>([]);
  const [tableRows, setTableRows] = useState<TabelaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
    setFrom(format(base, 'yyyy-MM-dd'));
    setTo(format(endOfMonth(base), 'yyyy-MM-dd'));
  }, [month]);

  const queryBase = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const vk = vendKey || BI_SPRINT_VENDAS_CONFIG.filters.vendedor;
    for (const v of selVendedores) if (v) q.append(vk, v);
    return q.toString();
  }, [from, to, selVendedores, vendKey]);

  const loadFacets = useCallback(async () => {
    const q = queryBase || `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    try {
      const j = await biGetJson<{ vendedores?: unknown[]; keys?: { vendedor?: string } }>(
        `/api/bi/sprint-vendas/facet-options?${q}`,
      );
      setVendOpts(Array.isArray(j.vendedores) ? (j.vendedores as string[]) : []);
      const k = j.keys || {};
      setVendKey(typeof k.vendedor === 'string' ? k.vendedor : BI_SPRINT_VENDAS_CONFIG.filters.vendedor);
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
      const [kpiR, rankR, tabR] = await Promise.all([
        biGetJsonSafe<{
          rows?: unknown[];
          meta?: { mesReferencia?: string; refLogica?: string | null };
        }>(`/api/bi/sprint-vendas/kpis${qs}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/sprint-vendas/ranking${qs}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/sprint-vendas/table${qs}`),
      ]);
      if (!kpiR.ok) throw new Error(kpiR.error);
      const kpiJ = kpiR.data;
      setKpis(Array.isArray(kpiJ.rows) && kpiJ.rows[0] ? (kpiJ.rows[0] as Row) : null);
      setKpiMeta(
        kpiJ.meta && typeof kpiJ.meta === 'object'
          ? {
              mesReferencia: String((kpiJ.meta as { mesReferencia?: string }).mesReferencia ?? ''),
              refLogica: (kpiJ.meta as { refLogica?: string | null }).refLogica ?? null,
            }
          : null,
      );
      const pickRows = (j: { rows?: unknown[] }) => (Array.isArray(j.rows) ? j.rows : []);
      setRanking(rankR.ok ? (pickRows(rankR.data) as Row[]) : []);
      setTableRows(tabR.ok ? (pickRows(tabR.data) as unknown as TabelaRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [queryBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const progressPct = useMemo(() => {
    const meta = toNum(kpis?.sum_meta_mensal);
    const vend = toNum(kpis?.sum_venda_auditada_mes);
    if (meta <= 0) return 0;
    return Math.min(100, (vend / meta) * 100);
  }, [kpis]);

  const rankingChart = useMemo(() => {
    return ranking.map((r, i) => {
      const p = toNum(r.percentual_atingimento);
      const pct = p * 100;
      return {
        vendedor: String(r.vendedor ?? ''),
        pct: Math.min(200, pct),
        fill: i === 0 ? GOLD : NAVY,
      };
    });
  }, [ranking]);

  const matrix = useMemo(() => {
    const weeks = new Map<number, { label: string; ord: number }>();
    for (const r of tableRows) {
      const ord = r.semana_mes_ordem != null ? Number(r.semana_mes_ordem) : NaN;
      if (!Number.isFinite(ord)) continue;
      const label = String(r.semana_mes_label ?? `Semana ${ord}`);
      if (!weeks.has(ord)) weeks.set(ord, { label, ord });
    }
    const weekList = [...weeks.values()].sort((a, b) => a.ord - b.ord);
    const byVend = new Map<string, TabelaRow[]>();
    for (const r of tableRows) {
      const v = String(r.vendedor ?? '');
      if (!v) continue;
      const arr = byVend.get(v) ?? [];
      arr.push(r);
      byVend.set(v, arr);
    }
    const vendors = [...byVend.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { weekList, vendors, byVend };
  }, [tableRows]);

  function toggleVend(v: string) {
    setSelVendedores((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  const mesLabel = useMemo(() => {
    if (!from) return '';
    try {
      return format(parse(from, 'yyyy-MM-dd', new Date()), 'MMMM yyyy', { locale: ptBR });
    } catch {
      return from.slice(0, 7);
    }
  }, [from]);

  const refLabel = kpiMeta?.refLogica
    ? format(parse(String(kpiMeta.refLogica).slice(0, 10), 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')
    : '—';

  return (
    <div className="min-h-full bg-gradient-to-br from-amber-50/40 via-white to-teal-50/30 pb-16 pt-2">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 md:px-6">
        <header className="relative overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-br from-white via-amber-50/20 to-teal-50/40 px-5 py-6 shadow-[0_16px_48px_rgba(12,74,110,0.12)] md:px-8 md:py-7">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-amber-400/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 size-40 rounded-full bg-teal-400/15 blur-2xl" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800/90">Gerencial</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Sprint de Vendas & Incentivos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Acompanhamento mensal da campanha comercial com metas, premiações e evolução semanal.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-500">
            Mês: <span className="font-semibold capitalize text-slate-800">{mesLabel}</span>
            <span className="mx-2 text-slate-300">·</span>
            Dia de referência: <span className="font-semibold text-slate-800">{refLabel}</span>
          </p>
        </header>

        <section className="rounded-2xl border border-amber-100 bg-white/95 px-4 py-4 shadow-sm md:px-5 md:py-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/60">Filtros</p>
          <div className="mt-3 flex flex-wrap items-end gap-3 md:gap-4">
            <label className="flex min-w-[180px] flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Período (mês da campanha)</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-amber-500/20 focus:border-amber-400 focus:ring-2"
              />
            </label>
            <CollapsibleMultiSelect
              label="Vendedora"
              options={vendOpts}
              selected={selVendedores}
              onToggle={toggleVend}
              onClear={() => setSelVendedores([])}
            />
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
            <Loader2 className="size-9 animate-spin text-amber-600" />
            <span className="text-sm font-medium">Carregando sprint…</span>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SPRINT_KPI_SLOTS.map((slot, idx) => (
                <div
                  key={slot.key}
                  className="rounded-2xl border border-white/80 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-amber-100/80"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: idx % 3 === 0 ? GOLD : idx % 3 === 1 ? WIN : NAVY,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{slot.label}</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 md:text-2xl">
                    {formatKpiValue(slot.format, kpis?.[slot.key])}
                  </p>
                </div>
              ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-teal-900/80">Progresso mensal vs meta</h2>
                <p className="mt-1 text-xs text-slate-500">Vendas auditadas no mês frente à meta consolidada do filtro.</p>
                <div className="mt-6">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>Realizado</span>
                    <span>
                      {formatBrl(toNum(kpis?.sum_venda_auditada_mes))} / {formatBrl(toNum(kpis?.sum_meta_mensal))}
                    </span>
                  </div>
                  <div className="mt-2 h-4 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-[width] duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-right text-lg font-bold text-teal-800">{progressPct.toFixed(1)}%</p>
                </div>
              </section>

              <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900/80">Corrida de metas</h2>
                <p className="mt-1 text-xs text-slate-500">Quem lidera o atingimento no mês.</p>
                <div className="mt-4 h-[280px] w-full min-w-0">
                  {rankingChart.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-400">Sem dados de ranking para este mês.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingChart} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" domain={[0, 'dataMax']} tickFormatter={(v) => `${v}%`} stroke="#64748b" fontSize={11} />
                        <YAxis
                          type="category"
                          dataKey="vendedor"
                          width={120}
                          tick={{ fontSize: 11, fill: '#334155' }}
                          stroke="#94a3b8"
                        />
                        <Tooltip
                          formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'Atingimento']}
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                        />
                        <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={22}>
                          {rankingChart.map((e, i) => (
                            <Cell key={e.vendedor} fill={e.fill} opacity={i === 0 ? 1 : 0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Matriz semanal</h2>
              <p className="mt-1 text-xs text-slate-500">Meta, realizado, percentual e resultado por semana do mês.</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-900 to-slate-800 text-left text-white">
                      <th className="sticky left-0 z-10 bg-slate-900 px-3 py-3 font-semibold">Vendedora</th>
                      {matrix.weekList.map((w) => (
                        <th key={w.ord} className="min-w-[140px] px-3 py-3 text-center font-semibold">
                          {w.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.vendors.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(2, matrix.weekList.length + 1)} className="px-4 py-10 text-center text-slate-400">
                          Nenhuma linha na matriz para os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      matrix.vendors.map((v) => (
                        <tr key={v} className="border-b border-slate-100 odd:bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2.5 font-semibold text-slate-900 shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
                            {v}
                          </td>
                          {matrix.weekList.map((w) => {
                            const cell = (matrix.byVend.get(v) ?? []).find((r) => Number(r.semana_mes_ordem) === w.ord);
                            if (!cell) {
                              return (
                                <td key={w.ord} className="px-2 py-2 text-center text-slate-300">
                                  —
                                </td>
                              );
                            }
                            const st = cell.status_semana;
                            return (
                              <td key={w.ord} className="align-top px-2 py-2 text-center text-xs text-slate-700">
                                <div className="rounded-lg border border-slate-100 bg-white px-2 py-2 shadow-sm">
                                  <div className="font-semibold text-slate-900">{formatBrl(toNum(cell.meta_semanal_est))}</div>
                                  <div className="mt-0.5 text-teal-800">{formatBrl(toNum(cell.venda_auditada_semana))}</div>
                                  <div className="mt-1 font-bold text-amber-800">{formatBiRatioAsPercent(cell.percentual_meta_semana)}</div>
                                  <div className="mt-1 text-lg leading-none">{st && st.trim() !== '' ? st : '—'}</div>
                                </div>
                              </td>
                            );
                          })}
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
