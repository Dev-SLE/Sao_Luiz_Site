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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return format(d, 'dd/MM/yyyy');
    }
    return String(v);
  }
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

function buildQuery(params: {
  from: string;
  to: string;
  grupoFluxo: string[];
  contaOrigem: string[];
  contaDestino: string[];
  q: string;
  sort?: string;
  dir?: string;
  limit?: number;
  offset?: number;
}): string {
  const u = new URLSearchParams();
  u.set('from', params.from);
  u.set('to', params.to);
  params.grupoFluxo.forEach((c) => u.append('grupoFluxo', c));
  params.contaOrigem.forEach((c) => u.append('contaOrigem', c));
  params.contaDestino.forEach((c) => u.append('contaDestino', c));
  if (params.q.trim()) u.set('q', params.q.trim());
  if (params.sort) u.set('sort', params.sort);
  if (params.dir) u.set('dir', params.dir);
  if (params.limit != null) u.set('limit', String(params.limit));
  if (params.offset != null) u.set('offset', String(params.offset));
  return u.toString();
}

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

export function FinanceiroBiTesourariaDashboard() {
  const { hasPermission } = useData();
  const can =
    hasPermission('tab.gerencial.setor.financeiro.view') || hasPermission('module.financeiro.view');

  const defaultTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const defaultFrom = useMemo(() => format(subMonths(new Date(), 12), 'yyyy-MM-dd'), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [grupoFluxo, setGrupoFluxo] = useState<string[]>([]);
  const [contaOrigem, setContaOrigem] = useState<string[]>([]);
  const [contaDestino, setContaDestino] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const [facetGrupos, setFacetGrupos] = useState<string[]>([]);
  const [facetOrigem, setFacetOrigem] = useState<string[]>([]);
  const [facetDestino, setFacetDestino] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [kpi, setKpi] = useState<{
    totalTransferido: number;
    totalTesouraria: number;
    totalSuprimento: number;
    totalConciliado: number;
    qtdTransferencias: number;
  } | null>(null);
  const [resumo, setResumo] = useState<Record<string, unknown>[]>([]);
  const [porOrigem, setPorOrigem] = useState<Record<string, unknown>[]>([]);
  const [porDestino, setPorDestino] = useState<Record<string, unknown>[]>([]);
  const [porGrupo, setPorGrupo] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [sort, setSort] = useState('data');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const baseQ = useMemo(
    () => buildQuery({ from, to, grupoFluxo, contaOrigem, contaDestino, q }),
    [from, to, grupoFluxo, contaOrigem, contaDestino, q],
  );

  const loadFacets = useCallback(async () => {
    try {
      const d = await biGetJson<{
        gruposFluxo?: string[];
        contasOrigem?: string[];
        contasDestino?: string[];
      }>('/api/bi/financeiro/tesouraria/facet-options');
      setFacetGrupos(Array.isArray(d.gruposFluxo) ? d.gruposFluxo : []);
      setFacetOrigem(Array.isArray(d.contasOrigem) ? d.contasOrigem : []);
      setFacetDestino(Array.isArray(d.contasDestino) ? d.contasDestino : []);
    } catch {
      /* facet opcional */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = baseQ;
      const [k, r, o, d, g, t] = await Promise.all([
        biGetJson<{
          totalTransferido: number;
          totalTesouraria: number;
          totalSuprimento: number;
          totalConciliado: number;
          qtdTransferencias: number;
        }>(`/api/bi/financeiro/tesouraria/kpis?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/tesouraria/resumo-mensal?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/tesouraria/por-origem?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/tesouraria/por-destino?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[] }>(`/api/bi/financeiro/tesouraria/por-grupo-fluxo?${qs}`),
        biGetJson<{ rows: Record<string, unknown>[]; total: number }>(
          `/api/bi/financeiro/tesouraria/transferencias?${buildQuery({
            from,
            to,
            grupoFluxo,
            contaOrigem,
            contaDestino,
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
      setPorOrigem(Array.isArray(o.rows) ? o.rows : []);
      setPorDestino(Array.isArray(d.rows) ? d.rows : []);
      setPorGrupo(Array.isArray(g.rows) ? g.rows : []);
      setRows(Array.isArray(t.rows) ? t.rows : []);
      setTotal(Number(t.total) || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [baseQ, contaDestino, contaOrigem, dir, from, grupoFluxo, offset, q, sort, to]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    setOffset(0);
  }, [from, to, grupoFluxo, contaOrigem, contaDestino, q]);

  useEffect(() => {
    if (!can) return;
    void loadAll();
  }, [can, loadAll]);

  const chartResumo = useMemo(
    () =>
      resumo.map((row) => ({
        mes: formatMesShort(String(row.mes_referencia ?? '')),
        total_transferido: toNum(row.total_transferido),
        total_tesouraria: toNum(row.total_tesouraria),
        total_suprimento: toNum(row.total_suprimento),
        total_conciliado: toNum(row.total_conciliado),
      })),
    [resumo],
  );

  const chartOrigem = useMemo(
    () =>
      porOrigem.map((row) => ({
        label: `${String(row.conta_origem ?? '').slice(0, 28)}`,
        valor_total: toNum(row.valor_total),
        banco: String(row.banco_origem ?? ''),
      })),
    [porOrigem],
  );

  const chartDestino = useMemo(
    () =>
      porDestino.map((row) => ({
        label: `${String(row.conta_destino ?? '').slice(0, 28)}`,
        valor_total: toNum(row.valor_total),
        banco: String(row.banco_destino ?? ''),
      })),
    [porDestino],
  );

  const chartGrupo = useMemo(
    () =>
      porGrupo.map((row) => ({
        grupo: String(row.grupo_fluxo ?? '—').slice(0, 32),
        valor_total: toNum(row.valor_total),
      })),
    [porGrupo],
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

  const kpiCards = kpi
    ? [
        { t: 'Total transferido', v: kpi.totalTransferido, tone: 'from-slate-900 to-sl-navy' },
        { t: 'Total tesouraria', v: kpi.totalTesouraria, tone: 'from-sky-900 to-sky-600' },
        { t: 'Total suprimento de caixa', v: kpi.totalSuprimento, tone: 'from-amber-900 to-amber-600' },
        { t: 'Total conciliado', v: kpi.totalConciliado, tone: 'from-emerald-900 to-emerald-600' },
        {
          t: 'Qtd. transferências',
          v: kpi.qtdTransferencias,
          tone: 'from-indigo-900 to-indigo-600',
          count: true,
        },
      ]
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-6">
      <div className="border-b border-slate-200/90 bg-white/95 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sl-red">Financeiro · BI</p>
              <h1 className="text-lg font-black text-slate-900 md:text-xl">Tesouraria e Fluxo de Caixa</h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">
                Transferências, circulação entre contas e conciliação. Período padrão: últimos 12 meses. Todos os
                blocos usam os mesmos filtros.
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
              label="Grupo de fluxo"
              options={facetGrupos.map((t) => ({ value: t, label: t }))}
              selected={grupoFluxo}
              onToggle={(v) => setGrupoFluxo((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setGrupoFluxo([])}
            />
            <BiFilterMulti
              label="Conta origem"
              options={facetOrigem.map((t) => ({ value: t, label: t }))}
              selected={contaOrigem}
              onToggle={(v) => setContaOrigem((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setContaOrigem([])}
            />
            <BiFilterMulti
              label="Conta destino"
              options={facetDestino.map((t) => ({ value: t, label: t }))}
              selected={contaDestino}
              onToggle={(v) => setContaDestino((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setContaDestino([])}
            />
            <label className="min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Busca</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Histórico, histórico limpo ou nº documento"
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="surface-card h-28 animate-pulse bg-slate-100/80" />
            ))}
          </div>
        ) : kpi ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {kpiCards.map((c) => (
              <div
                key={c.t}
                className={`surface-card-strong overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4 text-white shadow-md ${c.tone}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{c.t}</p>
                <p className="mt-2 text-2xl font-black tabular-nums">
                  {'count' in c && c.count ? c.v.toLocaleString('pt-BR') : formatBrl0(c.v as number)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="surface-card p-4">
          <h3 className="text-sm font-bold text-slate-900">Evolução mensal das transferências</h3>
          <p className="text-[11px] text-slate-500">Totais por mês (mesma lógica de bi.vw_tesouraria_resumo_geral, com filtros aplicados).</p>
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
                  <Tooltip formatter={(v: number) => formatBrl(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="total_transferido" name="Transferido" stroke="#0f172a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="total_tesouraria" name="Tesouraria" stroke="#0284c7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="total_suprimento" name="Suprimento" stroke="#d97706" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="total_conciliado" name="Conciliado" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-4">
            <h3 className="text-sm font-bold text-slate-900">Top contas de origem</h3>
            <p className="text-[11px] text-slate-500">Valor total por conta (origem).</p>
            <div className="mt-3 h-80">
              {loading && !porOrigem.length ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : chartOrigem.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartOrigem} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatBrl0(Number(v))} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number) => formatBrl(v)}
                      labelFormatter={(_, p) => {
                        const payload = p?.[0]?.payload as { banco?: string; label?: string } | undefined;
                        return payload?.banco ? `${payload.label} · ${payload.banco}` : String(payload?.label ?? '');
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="valor_total" name="Valor" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="surface-card p-4">
            <h3 className="text-sm font-bold text-slate-900">Top contas de destino</h3>
            <p className="text-[11px] text-slate-500">Valor total por conta (destino).</p>
            <div className="mt-3 h-80">
              {loading && !porDestino.length ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : chartDestino.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartDestino} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatBrl0(Number(v))} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number) => formatBrl(v)}
                      labelFormatter={(_, p) => {
                        const payload = p?.[0]?.payload as { banco?: string; label?: string } | undefined;
                        return payload?.banco ? `${payload.label} · ${payload.banco}` : String(payload?.label ?? '');
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="valor_total" name="Valor" fill="#0369a1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="surface-card p-4">
          <h3 className="text-sm font-bold text-slate-900">Distribuição por grupo de fluxo</h3>
          <p className="text-[11px] text-slate-500">Agregado equivalente a bi.vw_tesouraria_historicos, com filtros.</p>
          <div className="mt-3 h-72">
            {loading && !porGrupo.length ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="size-8 animate-spin" />
              </div>
            ) : chartGrupo.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartGrupo} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="grupo" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={56} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBrl0(Number(v))} width={72} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="valor_total" name="Valor" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Transferências (detalhe)</h3>
            <p className="text-[11px] text-slate-500">Fonte: bi.vw_tesouraria_transferencias — ordenação padrão: data mais recente.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-left text-xs">
              <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  {(
                    [
                      ['id_transferencia', 'ID'],
                      ['data', 'Data'],
                      ['data_conciliacao', 'Conciliação'],
                      ['vencimento', 'Vencimento'],
                      ['banco_origem', 'Banco origem'],
                      ['conta_origem', 'Conta origem'],
                      ['banco_destino', 'Banco destino'],
                      ['conta_destino', 'Conta destino'],
                      ['valor_transferencia', 'Valor'],
                      ['numero_documento', 'Documento'],
                      ['historico', 'Histórico'],
                      ['grupo_fluxo', 'Grupo'],
                      ['foi_conciliado', 'Conciliado'],
                      ['id_convenio_orig', 'Conv. orig.'],
                      ['id_convenio_dest', 'Conv. dest.'],
                      ['tipo', 'Tipo'],
                      ['tipo_transferencia', 'Tipo transf.'],
                      ['tipo_lcto', 'Tipo lanç.'],
                    ] as const
                  ).map(([key, lab]) => (
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
                    const conc =
                      row.foi_conciliado === true ||
                      String(row.foi_conciliado) === 't' ||
                      String(row.foi_conciliado).toLowerCase() === 'true';
                    const bOrig = String(row.nome_banco_origem ?? row.banco_origem ?? '—');
                    const bDest = String(row.nome_banco_destino ?? row.banco_destino ?? '—');
                    return (
                      <tr key={`${row.id_transferencia}-${idx}`} className="odd:bg-white even:bg-slate-50/50">
                        <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800">{String(row.id_transferencia ?? '')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.data)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.data_conciliacao)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(row.vencimento)}</td>
                        <td className="max-w-[120px] truncate px-2 py-2 text-slate-700" title={bOrig}>
                          {bOrig}
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-2 text-slate-700" title={String(row.conta_origem ?? '')}>
                          {String(row.conta_origem ?? '—')}
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-2 text-slate-700" title={bDest}>
                          {bDest}
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-2 text-slate-700" title={String(row.conta_destino ?? '')}>
                          {String(row.conta_destino ?? '—')}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {formatBrl(toNum(row.valor_transferencia))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.numero_documento ?? '—')}</td>
                        <td className="max-w-[200px] truncate px-2 py-2 text-slate-700" title={String(row.historico ?? '')}>
                          {String(row.historico ?? '—')}
                        </td>
                        <td className="px-2 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {String(row.grupo_fluxo ?? '—')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {conc ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Conciliado
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              Não conciliado
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.id_convenio_orig ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.id_convenio_dest ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.tipo ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.tipo_transferencia ?? '—')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{String(row.tipo_lcto ?? '—')}</td>
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
