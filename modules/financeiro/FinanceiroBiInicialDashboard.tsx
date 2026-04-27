'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { CollapsibleMultiSelectWithFilter } from '@/modules/bi/components/CollapsibleMultiSelectWithFilter';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';
import { useData } from '@/context/DataContext';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';
import clsx from 'clsx';

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n);
}

function formatBrl0(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function formatDatePt(v: unknown): string {
  if (v == null || v === '') return '—';
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(v);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return String(v);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function formatMesShort(iso: string): string {
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m] = s.split('-');
  return `${m}/${y.slice(2)}`;
}

function deltaPct(cur: number, prev: number): string | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(p)) return null;
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs período ant.`;
}

function buildQuery(params: {
  from: string;
  to: string;
  centroCusto: string[];
  tipoParte: string[];
  idEstabelecimento: string[];
  q: string;
  sort?: string;
  dir?: string;
  limit?: number;
  offset?: number;
}): string {
  const u = new URLSearchParams();
  u.set('from', params.from);
  u.set('to', params.to);
  params.centroCusto.forEach((c) => u.append('centroCusto', c));
  params.tipoParte.forEach((c) => u.append('tipoParte', c));
  params.idEstabelecimento.forEach((c) => u.append('idEstabelecimento', c));
  if (params.q.trim()) u.set('q', params.q.trim());
  if (params.sort) u.set('sort', params.sort);
  if (params.dir) u.set('dir', params.dir);
  if (params.limit != null) u.set('limit', String(params.limit));
  if (params.offset != null) u.set('offset', String(params.offset));
  return u.toString();
}

type FacetCentro = { codigo: string; descricao: string };

function BiFilterMulti(props: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <CollapsibleMultiSelectWithFilter
      label={props.label}
      options={props.options}
      selected={props.selected}
      onToggle={props.onToggle}
      onClear={props.onClear}
      allSummaryLabel="Todos"
      clearButtonLabel="Limpar"
      emptyMessage="Sem opções"
      labelMutedClassName="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
      detailsClassName="group relative z-50 min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200/90 bg-white shadow-sm open:z-[60] open:shadow-md"
      panelClassName="absolute left-0 right-0 top-full z-[70] mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-slate-900 shadow-xl"
      optionRowClassName="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-900 hover:bg-slate-50"
      optionLabelClassName="min-w-0 flex-1 truncate"
    />
  );
}

export function FinanceiroBiInicialDashboard() {
  const { hasPermission } = useData();
  const can =
    hasPermission('tab.gerencial.setor.financeiro.view') || hasPermission('module.financeiro.view');

  const defaultTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const defaultFrom = useMemo(() => format(subMonths(new Date(), 12), 'yyyy-MM-dd'), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [centro, setCentro] = useState<string[]>([]);
  const [tipoParte, setTipoParte] = useState<string[]>([]);
  const [estab, setEstab] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const [facetCentros, setFacetCentros] = useState<FacetCentro[]>([]);
  const [facetTipos, setFacetTipos] = useState<string[]>([]);
  const [facetEstabs, setFacetEstabs] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [kpi, setKpi] = useState<{
    current: { totalEmAberto: number; totalLiquidado: number; totalVencido: number; totalFaturado: number };
    previous: { totalEmAberto: number; totalLiquidado: number; totalVencido: number; totalFaturado: number };
  } | null>(null);
  const [resumo, setResumo] = useState<Record<string, unknown>[]>([]);
  const [centros, setCentros] = useState<Record<string, unknown>[]>([]);
  const [faturamento, setFaturamento] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [sort, setSort] = useState('data_lcto');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const baseQ = useMemo(
    () => buildQuery({ from, to, centroCusto: centro, tipoParte, idEstabelecimento: estab, q }),
    [from, to, centro, tipoParte, estab, q],
  );

  const loadFacets = useCallback(async () => {
    try {
      const d = await biGetJson<{
        centros?: FacetCentro[];
        tiposParte?: string[];
        estabelecimentos?: string[];
      }>('/api/bi/financeiro/facet-options');
      setFacetCentros(Array.isArray(d.centros) ? d.centros : []);
      setFacetTipos(Array.isArray(d.tiposParte) ? d.tiposParte : []);
      setFacetEstabs(Array.isArray(d.estabelecimentos) ? d.estabelecimentos : []);
    } catch {
      /* facet opcional */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = baseQ;
      const [k, r, c, f, t] = await Promise.all([
        biGetJson<{
          current: {
            totalEmAberto: number;
            totalLiquidado: number;
            totalVencido: number;
            totalFaturado: number;
          };
          previous: {
            totalEmAberto: number;
            totalLiquidado: number;
            totalVencido: number;
            totalFaturado: number;
          };
        }>(`/api/bi/financeiro/kpis?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/resumo-mensal?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/centro-custo?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/faturamento-mensal?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[]; total: number }>(
          `/api/bi/financeiro/obrigacoes?${buildQuery({
            from,
            to,
            centroCusto: centro,
            tipoParte,
            idEstabelecimento: estab,
            q,
            sort,
            dir,
            limit,
            offset,
          })}`,
        ),
      ]);
      setKpi(k);
      setResumo(Array.isArray(r.rows) ? r.rows : []);
      setCentros(Array.isArray(c.rows) ? c.rows : []);
      setFaturamento(Array.isArray(f.rows) ? f.rows : []);
      setRows(Array.isArray(t.rows) ? t.rows : []);
      setTotal(Number(t.total) || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [baseQ, centro, dir, estab, from, offset, q, sort, tipoParte, to]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    setOffset(0);
  }, [from, to, centro, tipoParte, estab, q]);

  useEffect(() => {
    if (!can) return;
    void loadAll();
  }, [can, loadAll]);

  const centroOptions = useMemo(
    () =>
      facetCentros.map((x) => ({
        value: x.codigo,
        label: x.descricao ? `${x.codigo} — ${x.descricao}` : x.codigo,
      })),
    [facetCentros],
  );

  const chartResumo = useMemo(
    () =>
      resumo.map((row) => ({
        mes: formatMesShort(String(row.mes_referencia ?? '')),
        total_em_aberto: toNum(row.total_em_aberto),
        total_liquidado: toNum(row.total_liquidado),
        total_vencido: toNum(row.total_vencido),
      })),
    [resumo],
  );

  const chartFat = useMemo(
    () =>
      faturamento.map((row) => ({
        mes: formatMesShort(String(row.mes_referencia ?? '')),
        valor_fatura: toNum(row.valor_fatura),
        valor_final: toNum(row.valor_final),
      })),
    [faturamento],
  );

  const chartCentro = useMemo(
    () =>
      centros.map((row) => ({
        nome: String(row.centro_custo_descricao ?? row.centro_custo_codigo ?? '—').slice(0, 42),
        valor_total: toNum(row.valor_total),
        valor_em_aberto: toNum(row.valor_em_aberto),
        valor_vencido: toNum(row.valor_vencido),
      })),
    [centros],
  );

  const onSort = (col: string) => {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(col);
      setDir('desc');
    }
  };

  if (!can) {
    return (
      <WorkspaceNoAccess message="Seu perfil não possui acesso ao setor Financeiro do Gerencial (ou ao módulo Financeiro)." />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-6">
      <div className="border-b border-slate-200/90 bg-white/95 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sl-red">Financeiro · Gerencial</p>
              <h1 className="text-lg font-black text-slate-900 md:text-xl">Financeiro Inicial</h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">
                Visão executiva de obrigações e faturamento. Ajuste o período e os filtros; todos os blocos usam os
                mesmos critérios.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-sl-navy/30 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Atualizar
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 md:gap-3">
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">De</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-sl-navy/40"
              />
            </label>
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Até</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-sl-navy/40"
              />
            </label>
            <BiFilterMulti
              label="Centro de custo"
              options={centroOptions}
              selected={centro}
              onToggle={(v) => setCentro((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setCentro([])}
            />
            <BiFilterMulti
              label="Tipo da parte"
              options={facetTipos.map((t) => ({ value: t, label: t }))}
              selected={tipoParte}
              onToggle={(v) => setTipoParte((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setTipoParte([])}
            />
            <BiFilterMulti
              label="Estabelecimento"
              options={facetEstabs.map((t) => ({ value: t, label: t }))}
              selected={estab}
              onToggle={(v) => setEstab((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setEstab([])}
            />
            <label className="min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Busca</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Histórico, documento ou ID obrigação"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sl-navy/40"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="rounded-xl bg-gradient-to-r from-sl-navy to-sl-navy-light px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 md:px-6">
        {err ? (
          <div className="surface-card flex items-start gap-3 border border-red-200 bg-red-50/80 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">Erro ao carregar</p>
              <p className="mt-1 text-red-700">{err}</p>
            </div>
          </div>
        ) : null}

        {loading && !kpi ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="surface-card h-28 animate-pulse bg-slate-100/80" />
            ))}
          </div>
        ) : kpi ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                t: 'Total em aberto',
                v: kpi.current.totalEmAberto,
                p: kpi.previous.totalEmAberto,
                tone: 'from-slate-900 to-sl-navy',
              },
              {
                t: 'Total liquidado',
                v: kpi.current.totalLiquidado,
                p: kpi.previous.totalLiquidado,
                tone: 'from-emerald-800 to-emerald-600',
              },
              {
                t: 'Total vencido',
                v: kpi.current.totalVencido,
                p: kpi.previous.totalVencido,
                tone: 'from-amber-900 to-amber-600',
              },
              {
                t: 'Total faturado',
                v: kpi.current.totalFaturado,
                p: kpi.previous.totalFaturado,
                tone: 'from-indigo-900 to-indigo-600',
              },
            ].map((c) => (
              <div
                key={c.t}
                className={`surface-card-strong overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4 text-white shadow-md ${c.tone}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{c.t}</p>
                <p className="mt-2 text-2xl font-black tabular-nums">{formatBrl0(c.v)}</p>
                <p className="mt-1 text-[11px] text-white/75">{deltaPct(c.v, c.p) ?? '—'}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-4">
            <h3 className="text-sm font-bold text-slate-900">Evolução financeira mensal</h3>
            <p className="text-[11px] text-slate-500">Aberto, liquidado e vencido por mês (obrigações filtradas).</p>
            <div className="mt-3 h-72">
              {loading && !resumo.length ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : chartResumo.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartResumo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBrl0(Number(v))} width={72} />
                    <Tooltip
                      formatter={(v: number) => formatBrl(v)}
                      labelFormatter={(l) => `Mês ${l}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="total_em_aberto" name="Em aberto" stroke="#0f172a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total_liquidado" name="Liquidado" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total_vencido" name="Vencido" stroke="#d97706" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="surface-card p-4">
            <h3 className="text-sm font-bold text-slate-900">Faturamento mensal</h3>
            <p className="text-[11px] text-slate-500">Valor faturado e valor final (view de faturas).</p>
            <div className="mt-3 h-72">
              {loading && !faturamento.length ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : chartFat.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem faturamento no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartFat} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBrl0(Number(v))} width={72} />
                    <Tooltip formatter={(v: number) => formatBrl(v)} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="valor_fatura" name="Valor fatura" stroke="#312e81" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="valor_final" name="Valor final" stroke="#0369a1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="surface-card p-4">
          <h3 className="text-sm font-bold text-slate-900">Distribuição por centro de custo</h3>
          <p className="text-[11px] text-slate-500">Total, em aberto e vencido (top 40 centros no período filtrado).</p>
          <div className="mt-3 h-[min(28rem,calc(100vh-24rem))] min-h-[240px]">
            {loading && !centros.length ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="size-8 animate-spin" />
              </div>
            ) : chartCentro.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados agregados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartCentro} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatBrl0(Number(v))} />
                  <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="valor_total" name="Total" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="valor_em_aberto" name="Em aberto" fill="#64748b" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="valor_vencido" name="Vencido" fill="#c2410c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Obrigações (detalhe)</h3>
            <p className="text-[11px] text-slate-500">Fonte: bi.vw_fin_obrigacoes_validas — clique no cabeçalho para ordenar.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  {[
                    ['id_obrigacao', 'ID'],
                    ['data_lcto', 'Lançamento'],
                    ['data_emissao', 'Emissão'],
                    ['vencimento', 'Vencimento'],
                    ['data_liquidacao', 'Liquidação'],
                    ['tipo_parte', 'Tipo parte'],
                    ['centro_custo_codigo', 'CC'],
                    ['centro_custo_descricao', 'Centro'],
                    ['historico', 'Histórico'],
                    ['documento', 'Documento'],
                    ['valor_principal', 'Vl. principal'],
                    ['valor_total_calculado', 'Vl. total'],
                    ['valor_liquidado', 'Vl. liquidado'],
                    ['status_financeiro', 'Status'],
                    ['id_estabelecimento', 'Estab.'],
                    ['id_convenio', 'Convênio'],
                  ].map(([key, lab]) => (
                    <th key={key} className="whitespace-nowrap px-2 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-sl-navy"
                        onClick={() => onSort(key)}
                      >
                        {lab}
                        {sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-2">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !rows.length ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-12 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 size-6 animate-spin" />
                      Carregando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-10 text-center text-slate-500">
                      Nenhum registro para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const liq = row.foi_liquidado === true || String(row.foi_liquidado) === 't';
                    const venc = row.esta_vencido === true || String(row.esta_vencido) === 't';
                    return (
                      <tr
                        key={`${row.id_obrigacao}-${idx}`}
                        className={clsx('odd:bg-white even:bg-slate-50/50', venc && !liq && 'bg-amber-50/90')}
                      >
                        <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800">{String(row.id_obrigacao ?? '')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.data_lcto)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.data_emissao)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.vencimento)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.data_liquidacao)}</td>
                        <td className="px-2 py-2 text-slate-700">{String(row.tipo_parte ?? '—')}</td>
                        <td className="px-2 py-2 text-slate-700">{String(row.centro_custo_codigo ?? '—')}</td>
                        <td className="max-w-[200px] truncate px-2 py-2 text-slate-700" title={String(row.centro_custo_descricao ?? '')}>
                          {String(row.centro_custo_descricao ?? '—')}
                        </td>
                        <td className="max-w-[220px] truncate px-2 py-2 text-slate-700" title={String(row.historico ?? '')}>
                          {String(row.historico ?? '—')}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.documento ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                          {formatBrl(toNum(row.valor_principal))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {formatBrl(toNum(row.valor_total_calculado))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">
                          {formatBrl(toNum(row.valor_liquidado))}
                        </td>
                        <td className="px-2 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {String(row.status_financeiro ?? '—')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.id_estabelecimento ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.id_convenio ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {liq ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Liquidado
                            </span>
                          ) : venc ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              Vencido
                            </span>
                          ) : (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">Aberto</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-2 text-xs text-slate-600">
            <span>
              {total === 0 ? '0' : `${offset + 1}–${Math.min(offset + rows.length, total)}`} de {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset <= 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" /> Anterior
              </button>
              <button
                type="button"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset((o) => o + limit)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-700 disabled:opacity-40"
              >
                Próxima <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
