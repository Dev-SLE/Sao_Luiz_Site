'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, ChevronDown, Download, Loader2, X } from 'lucide-react';
import {
  BI_FUNIL_VENDAS_CONFIG,
  FUNIL_ETAPA_ORDER,
  FUNIL_KPI_SLOTS_PRIMARY,
  FUNIL_KPI_SLOTS_SECONDARY,
  FUNIL_TABELA_COLUNAS,
} from '@/modules/bi/funilVendas/config';

type Row = Record<string, unknown>;

const NAVY = '#1e3a5f';
const SLATE = '#64748b';

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

function formatPct(raw: unknown): string {
  const n = toNum(raw);
  if (n > 0 && n <= 1 && !Number.isInteger(n)) {
    return `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  }
  if (n > 1 && n <= 100) return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  return `${n}%`;
}

function etapaColor(etapa: string): string {
  const hit = FUNIL_ETAPA_ORDER.find((e) => e.etapa === etapa);
  return hit?.color ?? '#94a3b8';
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('NEGOC')) return 'bg-amber-100 text-amber-950 ring-amber-200/80';
  if (s.includes('FECHAD')) return 'bg-emerald-100 text-emerald-950 ring-emerald-200/80';
  if (s.includes('PERDIDO') || s.includes('EXPIR')) return 'bg-slate-100 text-slate-800 ring-slate-200/80';
  if (s.includes('CANCEL')) return 'bg-red-100 text-red-950 ring-red-200/80';
  return 'bg-indigo-100 text-indigo-950 ring-indigo-200/80';
}

function statusDisplayLabel(raw: string): string {
  const u = raw.toUpperCase();
  if (u === 'EM NEGOCIACAO') return 'Em negociação';
  if (u === 'VENDA FECHADA') return 'Venda fechada';
  if (u === 'PERDIDO (EXPIRADO)') return 'Perdido (expirado)';
  if (u === 'VENDA CANCELADA') return 'Venda cancelada';
  if (u === 'OUTROS') return 'Outros';
  return raw.replace(/_/g, ' ');
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
  const summary = selected.length ? `${selected.length} selecionado(s)` : 'Todos';
  return (
    <details className="group relative min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm open:z-30 open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Sem opções</p>
        ) : (
          options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="rounded border-slate-300 text-sl-navy focus:ring-sl-navy/30"
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

type TabelaOpcao = { id: string; nome: string };

function FacetMultiSelectTabela({
  label,
  options,
  selectedIds,
  onToggle,
  onClear,
}: {
  label: string;
  options: TabelaOpcao[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const summary = selectedIds.length ? `${selectedIds.length} selecionado(s)` : 'Todos';
  return (
    <details className="group relative min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm open:z-30 open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 min-w-[280px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Sem opções</p>
        ) : (
          options.map((opt) => (
            <label key={opt.id} className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedIds.includes(opt.id)}
                onChange={() => onToggle(opt.id)}
                className="mt-0.5 rounded border-slate-300 text-sl-navy focus:ring-sl-navy/30"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{opt.nome}</span>
                <span className="text-[11px] text-slate-500">ID {opt.id}</span>
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

export function BiFunilVendasDashboard() {
  const defaultFrom = useMemo(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'), []);
  const defaultTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [selStatus, setSelStatus] = useState<string[]>([]);
  const [selVendedores, setSelVendedores] = useState<string[]>([]);
  const [selTabelas, setSelTabelas] = useState<string[]>([]);
  const [facetKeys, setFacetKeys] = useState<{
    status_funil: string | null;
    vendedor: string | null;
    cot_id_tabela: string | null;
  }>({ status_funil: null, vendedor: null, cot_id_tabela: null });
  const [statusOpts, setStatusOpts] = useState<string[]>([]);
  const [vendOpts, setVendOpts] = useState<string[]>([]);
  const [tabelaOpcoes, setTabelaOpcoes] = useState<TabelaOpcao[]>([]);

  const [kpis, setKpis] = useState<Row | null>(null);
  const [funnel, setFunnel] = useState<Row[]>([]);
  const [conv, setConv] = useState<Row[]>([]);
  const [valorFech, setValorFech] = useState<Row[]>([]);
  const [qtdFech, setQtdFech] = useState<Row[]>([]);
  const [evolucao, setEvolucao] = useState<Row[]>([]);
  const [tableRows, setTableRows] = useState<Row[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const [drillTitle, setDrillTitle] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<Row[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryBase = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const K = facetKeys;
    const F = BI_FUNIL_VENDAS_CONFIG.filters;
    const sk = K.status_funil || F.statusFunil;
    const vk = K.vendedor || F.vendedor;
    const tk = K.cot_id_tabela || F.cotIdTabela;
    for (const v of selStatus) if (v) q.append(sk, v);
    for (const v of selVendedores) if (v) q.append(vk, v);
    for (const v of selTabelas) if (v) q.append(tk, v);
    return q.toString();
  }, [from, to, selStatus, selVendedores, selTabelas, facetKeys]);

  const loadFacets = useCallback(async () => {
    const q = queryBase || `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(`/api/bi/funil-vendas/facet-options?${q}`, { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setStatusOpts(Array.isArray(j.status_funil) ? j.status_funil : []);
    setVendOpts(Array.isArray(j.vendedores) ? j.vendedores : []);
    const tops = Array.isArray(j.tabela_opcoes) ? j.tabela_opcoes : [];
    setTabelaOpcoes(
      tops
        .filter((x: unknown) => x && typeof x === "object" && "id" in (x as object))
        .map((x: { id: unknown; nome: unknown }) => ({
          id: String(x.id ?? "").trim(),
          nome: String(x.nome ?? "").trim(),
        }))
        .filter((x: TabelaOpcao) => x.id.length > 0),
    );
    const k = j.keys || {};
    setFacetKeys({
      status_funil: typeof k.status_funil === 'string' ? k.status_funil : null,
      vendedor: typeof k.vendedor === 'string' ? k.vendedor : null,
      cot_id_tabela: typeof k.cot_id_tabela === 'string' ? k.cot_id_tabela : null,
    });
  }, [queryBase, from, to]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(tableSearch.trim()), 320);
    return () => window.clearTimeout(id);
  }, [tableSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = queryBase ? `?${queryBase}` : '';
      const [kpiRes, funRes, convRes, vfRes, qfRes, evRes] = await Promise.all([
        fetch(`/api/bi/funil-vendas/kpis${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/funil-vendas/funnel${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/funil-vendas/conversao-vendedor${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/funil-vendas/valor-fechado-vendedor${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/funil-vendas/quantidade-fechada-vendedor${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/funil-vendas/evolucao-mensal${qs}`, { credentials: 'include' }),
      ]);
      if (!kpiRes.ok) throw new Error((await kpiRes.json().catch(() => ({})))?.error || kpiRes.statusText);
      const kpiJ = await kpiRes.json();
      setKpis(Array.isArray(kpiJ.rows) && kpiJ.rows[0] ? kpiJ.rows[0] : null);
      const pick = async (r: Response) => {
        const j = await r.json().catch(() => ({}));
        return Array.isArray(j.rows) ? j.rows : [];
      };
      setFunnel(funRes.ok ? await pick(funRes) : []);
      setConv(convRes.ok ? await pick(convRes) : []);
      setValorFech(vfRes.ok ? await pick(vfRes) : []);
      setQtdFech(qfRes.ok ? await pick(qfRes) : []);
      setEvolucao(evRes.ok ? await pick(evRes) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [queryBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadTable = useCallback(async () => {
    const q = new URLSearchParams(queryBase);
    q.set('limit', '800');
    if (debouncedSearch) q.set('search', debouncedSearch);
    try {
      const res = await fetch(`/api/bi/funil-vendas/table?${q.toString()}`, { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setTableRows(Array.isArray(j.rows) ? j.rows : []);
    } catch {
      setTableRows([]);
    }
  }, [queryBase, debouncedSearch]);

  useEffect(() => {
    void reloadTable();
  }, [reloadTable]);

  const funnelChartData = useMemo(() => {
    return funnel.map((r) => {
      const etapa = String(r.etapa ?? '');
      return {
        etapa,
        label: statusDisplayLabel(etapa),
        qtd: toNum(r.qtd_registros),
        valor_cotado: toNum(r.valor_cotado),
        fill: etapaColor(etapa),
      };
    });
  }, [funnel]);

  const evolucaoChartData = useMemo(() => {
    return evolucao.map((r) => ({
      mes: String(r.mes_ano ?? r.mes_nome ?? ''),
      qtd_cotacoes: toNum(r.qtd_cotacoes),
      qtd_fechadas: toNum(r.qtd_fechadas),
      valor_cotado: toNum(r.valor_cotado),
      valor_fechado: toNum(r.valor_fechado),
    }));
  }, [evolucao]);

  const exportXlsx = async () => {
    setExporting(true);
    setError(null);
    try {
      const q = new URLSearchParams(queryBase);
      if (tableSearch.trim()) q.set('search', tableSearch.trim());
      const res = await fetch(`/api/bi/funil-vendas/export-table?${q.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(String(j?.error || res.statusText));
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? 'Performance_vendas.xlsx';
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

  const fixDrillUrl = (name: string) => {
    const q = new URLSearchParams(queryBase);
    q.set('vendedor', name);
    return `/api/bi/funil-vendas/drill?${q.toString()}`;
  };

  const openDrillFixed = async (vendedorNome: string) => {
    const name = String(vendedorNome || '').trim();
    if (!name) return;
    setDrillTitle(name);
    setDrillRows([]);
    const res = await fetch(fixDrillUrl(name), { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(String(j?.error || 'Falha no detalhamento'));
      return;
    }
    setError(null);
    setDrillRows(Array.isArray(j.rows) ? j.rows : []);
  };

  function toggle(list: string[], setList: (u: string[]) => void, v: string) {
    if (list.includes(v)) setList(list.filter((x) => x !== v));
    else setList([...list, v]);
  }

  const kpiVal = (key: string) => kpis?.[key];

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-white to-slate-50/90 pb-14 pt-2">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 md:px-6">
        <header className="rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white via-white to-slate-50/90 px-5 py-6 shadow-[0_12px_40px_rgba(30,58,95,0.08)] md:px-8 md:py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sl-red">Gerencial</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">Performance de Vendas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Acompanhamento comercial do funil de cotações até o fechamento.
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
            <CollapsibleMultiSelect
              label="Status"
              options={statusOpts}
              selected={selStatus}
              onToggle={(v) => toggle(selStatus, setSelStatus, v)}
              onClear={() => setSelStatus([])}
            />
            <CollapsibleMultiSelect
              label="Vendedor"
              options={vendOpts}
              selected={selVendedores}
              onToggle={(v) => toggle(selVendedores, setSelVendedores, v)}
              onClear={() => setSelVendedores([])}
            />
            <FacetMultiSelectTabela
              label="Nome da tabela"
              options={tabelaOpcoes}
              selectedIds={selTabelas}
              onToggle={(id) => toggle(selTabelas, setSelTabelas, id)}
              onClear={() => setSelTabelas([])}
            />
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-900 shadow-sm">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {loading && !kpis ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sl-navy/20 bg-white py-24 text-slate-600 shadow-inner">
            <Loader2 className="animate-spin text-sl-navy" size={32} />
            <span className="text-sm font-medium">Carregando indicadores…</span>
          </div>
        ) : null}

        {!loading && !tableRows.length && !funnel.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-600 shadow-sm">
            Não há dados para o período e filtros selecionados.
          </div>
        ) : null}

        {kpis ? (
          <>
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Indicadores principais</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FUNIL_KPI_SLOTS_PRIMARY.map((slot) => (
                  <div
                    key={slot.key}
                    className="relative overflow-hidden rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white to-slate-50/90 p-5 shadow-[0_8px_30px_rgba(30,58,95,0.07)]"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-sl-red/10" aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{slot.label}</p>
                    <p className="relative mt-3 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">
                      {slot.format === 'integer'
                        ? formatInt(toNum(kpiVal(slot.key)))
                        : formatPct(kpiVal(slot.key))}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {FUNIL_KPI_SLOTS_SECONDARY.map((slot) => (
                  <div
                    key={slot.key}
                    className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{slot.label}</p>
                    <p className="mt-2 text-xl font-bold text-sl-navy">{formatBrl(toNum(kpiVal(slot.key)))}</p>
                  </div>
                ))}
              </div>
            </section>

            {funnelChartData.length > 0 ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_36px_rgba(15,23,42,0.06)] md:p-6">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-sl-navy">Funil por status</h2>
                  <p className="text-xs text-slate-500">Volume de cotações em cada etapa do funil no período.</p>
                </div>
                <div className="h-[320px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelChartData} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: SLATE, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={168}
                        tick={{ fontSize: 11, fill: NAVY, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(30, 58, 95, 0.06)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0]?.payload as (typeof funnelChartData)[0];
                          return (
                            <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-xs shadow-xl">
                              <p className="font-bold text-sl-navy">{p.label}</p>
                              <p className="mt-1 text-slate-600">
                                Cotações: <span className="font-semibold text-slate-900">{formatInt(p.qtd)}</span>
                              </p>
                              <p className="text-slate-600">
                                Valor cotado: <span className="font-semibold text-slate-900">{formatBrl(p.valor_cotado)}</span>
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="qtd" radius={[0, 6, 6, 0]} barSize={26}>
                        {funnelChartData.map((e, i) => (
                          <Cell key={i} fill={e.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}

            {evolucaoChartData.length > 0 ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_36px_rgba(15,23,42,0.06)] md:p-6">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-sl-navy">Evolução mensal</h2>
                  <p className="text-xs text-slate-500">Cotações e fechamentos por competência.</p>
                </div>
                <div className="h-[300px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucaoChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                        formatter={(v: number, name: string) => [
                          name.includes('valor') ? formatBrl(Number(v)) : formatInt(Number(v)),
                          name === 'qtd_cotacoes' ? 'Cotações' : name === 'qtd_fechadas' ? 'Fechadas' : name,
                        ]}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="qtd_cotacoes" name="Cotações" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="qtd_fechadas" name="Fechadas" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-3">
              {[
                { title: 'Conversão por vendedor', sub: '% de cotações com venda fechada', data: conv, vk: 'vendedor', dk: 'conversao', fmt: 'pct' as const },
                { title: 'Valor fechado por vendedor', sub: 'Somatório de CT-e na venda fechada', data: valorFech, vk: 'vendedor', dk: 'valor_fechado', fmt: 'brl' as const },
                { title: 'Quantidade fechada', sub: 'Cotações com status venda fechada', data: qtdFech, vk: 'vendedor', dk: 'qtd_fechada', fmt: 'int' as const },
              ].map((block) => (
                <div
                  key={block.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_36px_rgba(15,23,42,0.05)] md:p-5"
                >
                  <h3 className="text-sm font-bold text-sl-navy">{block.title}</h3>
                  <p className="text-[11px] text-slate-500">{block.sub}</p>
                  <div className="mt-3 h-[220px] w-full min-w-0">
                    {block.data.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={block.data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey={block.vk} tick={{ fontSize: 9, fill: SLATE }} interval={0} angle={-28} textAnchor="end" height={70} />
                          <YAxis tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(v: number) =>
                              block.fmt === 'brl' ? formatBrl(v) : block.fmt === 'pct' ? formatPct(v) : formatInt(v)
                            }
                          />
                          <Bar
                            dataKey={block.dk}
                            fill="#1e3a5f"
                            radius={[4, 4, 0, 0]}
                            className="cursor-pointer"
                            onClick={(data: unknown) => {
                              const d = data as { payload?: Row };
                              const v = d?.payload?.[block.vk];
                              if (v != null) void openDrillFixed(String(v));
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="py-8 text-center text-xs text-slate-400">Sem dados</p>
                    )}
                  </div>
                  <p className="mt-1 text-center text-[10px] text-slate-400">Clique em uma barra para detalhar o vendedor</p>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
              <div className="border-b border-sl-navy/10 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-5 py-4">
                <h2 className="text-lg font-bold text-white">Cotações</h2>
                <p className="text-xs font-medium text-white/80">Detalhe por linha — clique para ver o vendedor no funil</p>
              </div>
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-3 md:flex-row md:items-end md:justify-between">
                <label className="flex max-w-md flex-1 flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pesquisar</span>
                  <input
                    type="search"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Filtrar por qualquer coluna…"
                    className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sl-navy/40 focus:ring-2 focus:ring-sl-navy/15"
                  />
                </label>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void exportXlsx()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sl-navy/25 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={2} />}
                  Exportar planilha (XLSX)
                </button>
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100/95 text-xs font-bold uppercase tracking-wide text-slate-600">
                      {FUNIL_TABELA_COLUNAS.map((c) => (
                        <th key={c.key} className="whitespace-nowrap px-4 py-3">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => (
                      <tr
                        key={i}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-100/80 odd:bg-white even:bg-slate-50/50"
                        onClick={() => {
                          const v = r.vendedor;
                          if (v != null && String(v).trim()) void openDrillFixed(String(v));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const v = r.vendedor;
                            if (v != null && String(v).trim()) void openDrillFixed(String(v));
                          }
                        }}
                      >
                        {FUNIL_TABELA_COLUNAS.map((c) => (
                          <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-slate-800">
                            {c.key === 'status' ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${statusBadgeClass(String(r[c.key] ?? ''))}`}
                              >
                                {statusDisplayLabel(String(r[c.key] ?? '—'))}
                              </span>
                            ) : c.key === 'nome_tabela' ? (
                              String(r[c.key] ?? '—')
                            ) : c.key === 'valor_cotacao' ? (
                              formatBrl(toNum(r[c.key]))
                            ) : c.key === 'data_cotacao' ? (
                              (() => {
                                const raw = r[c.key];
                                try {
                                  const d = raw instanceof Date ? raw : new Date(String(raw));
                                  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy HH:mm');
                                } catch {
                                  return '—';
                                }
                              })()
                            ) : (
                              String(r[c.key] ?? '—')
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {drillTitle ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => {
            setDrillTitle(null);
            setDrillRows([]);
          }}
        >
          <aside
            className="flex h-full w-full max-w-lg animate-in slide-in-from-right flex-col border-l border-slate-200 bg-white shadow-2xl duration-200"
            role="dialog"
            aria-modal
            aria-labelledby="funil-drill-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-sl-red">Detalhamento</p>
                <h3 id="funil-drill-title" className="mt-1 text-lg font-bold text-sl-navy">
                  {drillTitle}
                </h3>
                <p className="text-xs text-slate-500">Resumo por status no período filtrado</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                onClick={() => {
                  setDrillTitle(null);
                  setDrillRows([]);
                }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!drillRows.length ? (
                <p className="text-sm text-slate-500">Nenhum detalhe para este vendedor no período.</p>
              ) : (
                <div className="space-y-3">
                  {drillRows.map((r, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${statusBadgeClass(String(r.status_funil ?? ''))}`}
                        >
                          {statusDisplayLabel(String(r.status_funil ?? '—'))}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">{formatInt(toNum(r.qtd_registros))} cotações</span>
                      </div>
                      <dl className="grid gap-1.5 text-sm text-slate-700">
                        <div className="flex justify-between gap-4">
                          <dt>Valor cotado</dt>
                          <dd className="font-semibold text-slate-900">{formatBrl(toNum(r.valor_cotado))}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Valor fechado (CT-e)</dt>
                          <dd className="font-semibold text-slate-900">{formatBrl(toNum(r.valor_fechado))}</dd>
                        </div>
                        <div className="flex justify-between gap-4 text-xs text-slate-500">
                          <dt>Primeira cotação</dt>
                          <dd>{String(r.primeira_cotacao ?? '—')}</dd>
                        </div>
                        <div className="flex justify-between gap-4 text-xs text-slate-500">
                          <dt>Última cotação</dt>
                          <dd>{String(r.ultima_cotacao ?? '—')}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
