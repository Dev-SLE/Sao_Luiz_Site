'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
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
import { AlertCircle, ChevronDown, Download, Loader2, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import { BI_TABELAS_COMBINADAS_CONFIG } from '@/modules/bi/tabelasCombinadas/config';

const F = BI_TABELAS_COMBINADAS_CONFIG.filters;

type KpiRow = Record<string, unknown>;

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function formatBrl2(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n);
}

function formatPct01(n: number): string {
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** yyyy-MM-dd ou timestamp ISO → dd/MM/yyyy; evita RangeError com datas inválidas (ex.: zeros do PG). */
function formatDateBr(value: unknown): string {
  if (value == null) return '—';
  const raw = String(value).trim();
  if (!raw) return '—';
  const datePart = raw.length >= 10 ? raw.slice(0, 10) : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return '—';
  const parsed = parseISO(datePart);
  if (!isValid(parsed)) return '—';
  try {
    return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function buildQuery(
  from: string,
  to: string,
  vendedores: string[],
  status: string[],
  clientes: string[],
  search: string,
  extra?: Record<string, string>,
): string {
  const u = new URLSearchParams();
  u.set('from', from);
  u.set('to', to);
  vendedores.forEach((v) => u.append(F.vendedor, v));
  status.forEach((s) => u.append(F.statusAtual, s));
  clientes.forEach((c) => u.append(F.cliente, c));
  if (search.trim()) u.set('search', search.trim());
  if (extra) Object.entries(extra).forEach(([k, v]) => u.set(k, v));
  return u.toString();
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('CRÍTICO') || s.includes('CRITICO')) return 'border-rose-300 bg-rose-50 text-rose-900';
  if (s.includes('OURO') || s.includes('RECUPERAR')) return 'border-amber-300 bg-amber-50 text-amber-950';
  if (s.includes('ALERTA')) return 'border-orange-300 bg-orange-50 text-orange-950';
  if (s.includes('VENCIDO')) return 'border-violet-300 bg-violet-50 text-violet-950';
  if (s.includes('VIGENTE')) return 'border-emerald-300 bg-emerald-50 text-emerald-900';
  if (s.includes('VITAL')) return 'border-sky-300 bg-sky-50 text-sky-950';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

const DONUT_COLORS = ['#c2410c', '#ea580c', '#f59e0b', '#0d9488', '#1e3a5f', '#6366f1', '#7c3aed', '#94a3b8'];

function MultiFacet({
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
    <details className="group relative min-w-[200px] flex-1 rounded-xl border border-slate-200/90 bg-white shadow-sm open:z-30 open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-slate-900 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">Sem opções no período</p>
        ) : (
          options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-900 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="rounded border-slate-300 text-sl-navy focus:ring-sl-navy/30"
              />
              <span className="min-w-0 flex-1 truncate" title={opt}>
                {opt}
              </span>
            </label>
          ))
        )}
        <div className="border-t border-slate-100 px-3 pt-2 text-slate-900">
          <button type="button" className="text-xs font-semibold text-sl-navy underline" onClick={onClear}>
            Limpar
          </button>
        </div>
      </div>
    </details>
  );
}

export function BiTabelasCombinadasDashboard() {
  const now = new Date();
  const defaultTo = format(new Date(now.getFullYear(), now.getMonth() + 6, 0), 'yyyy-MM-dd');
  const defaultFrom = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const [facetV, setFacetV] = useState<string[]>([]);
  const [facetS, setFacetS] = useState<string[]>([]);
  const [facetC, setFacetC] = useState<string[]>([]);

  const [kpi, setKpi] = useState<KpiRow | null>(null);
  const [riscoRows, setRiscoRows] = useState<Array<{ vendedor: string; risco_financeiro: number; risco_silencioso: number }>>([]);
  const [statusRows, setStatusRows] = useState<Array<{ status_grupo: string; valor: number; qtd_contratos: number }>>([]);
  const [topCli, setTopCli] = useState<
    Array<{
      cliente: string;
      score_prioridade_medio: number;
      risco_financeiro_valor: number;
      risco_silencioso_valor: number;
      oportunidade_recuperacao_valor: number;
      ultima_compra: string | null;
      qtd_ctes: number;
      total_volumes: number;
      proxima_acao: string | null;
    }>
  >([]);
  const [pipeRows, setPipeRows] = useState<Array<{ pipeline_fase: string; qtd_contratos: number; total_comprado: number }>>([]);
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableMeta, setTableMeta] = useState<{ limit: number; offset: number } | null>(null);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const [drillCliente, setDrillCliente] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const qBase = useMemo(() => buildQuery(from, to, vendedores, statusSel, clientesSel, search), [from, to, vendedores, statusSel, clientesSel, search]);

  const exportXlsx = useCallback(async () => {
    setExporting(true);
    setExportErr(null);
    try {
      const res = await fetch(`/api/bi/tabelas-combinadas/export-table?${qBase}`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(String((j as { error?: string })?.error || res.statusText));
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? 'Carteira_renovacao.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Falha ao exportar');
    } finally {
      setExporting(false);
    }
  }, [qBase]);

  const loadFacets = useCallback(async () => {
    const res = await fetch(`/api/bi/tabelas-combinadas/facet-options?${buildQuery(from, to, [], [], [], '')}`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const d = await res.json();
    setFacetV(Array.isArray(d.vendedores) ? d.vendedores : []);
    setFacetS(Array.isArray(d.status) ? d.status : []);
    setFacetC(Array.isArray(d.clientes) ? d.clientes : []);
  }, [from, to]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = qBase;
      const [kRes, rRes, sRes, tRes, pRes, tabRes] = await Promise.all([
        fetch(`/api/bi/tabelas-combinadas/kpis?${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/tabelas-combinadas/vendedor-risco?${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/tabelas-combinadas/status-diagnostico?${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/tabelas-combinadas/top-clientes?${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/tabelas-combinadas/pipeline?${qs}`, { credentials: 'include' }),
        fetch(`/api/bi/tabelas-combinadas/table?${qs}&limit=80&offset=${offset}`, { credentials: 'include' }),
      ]);
      if (!kRes.ok) throw new Error((await kRes.json().catch(() => ({})))?.error || `KPIs HTTP ${kRes.status}`);
      const kj = await kRes.json();
      setKpi((kj.row as KpiRow) || {});

      if (rRes.ok) {
        const rj = await rRes.json();
        setRiscoRows(Array.isArray(rj.rows) ? rj.rows : []);
      } else setRiscoRows([]);
      if (sRes.ok) {
        const sj = await sRes.json();
        setStatusRows(Array.isArray(sj.rows) ? sj.rows : []);
      } else setStatusRows([]);
      if (tRes.ok) {
        const tj = await tRes.json();
        setTopCli(Array.isArray(tj.rows) ? tj.rows : []);
      } else setTopCli([]);
      if (pRes.ok) {
        const pj = await pRes.json();
        setPipeRows(Array.isArray(pj.rows) ? pj.rows : []);
      } else setPipeRows([]);
      if (tabRes.ok) {
        const tb = await tabRes.json();
        setTableRows(Array.isArray(tb.rows) ? tb.rows : []);
        setTableMeta(tb.meta || null);
      } else {
        setTableRows([]);
        setTableMeta(null);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [qBase, offset]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openDrill = async (cliente: string) => {
    setDrillCliente(cliente);
    setDrillLoading(true);
    setDrillRows([]);
    try {
      const qs = `${qBase}&cliente=${encodeURIComponent(cliente)}`;
      const res = await fetch(`/api/bi/tabelas-combinadas/drill?${qs}`, { credentials: 'include' });
      const d = res.ok ? await res.json() : { rows: [] };
      setDrillRows(Array.isArray(d.rows) ? d.rows : []);
    } finally {
      setDrillLoading(false);
    }
  };

  const donutData = useMemo(
    () => statusRows.map((r, i) => ({ name: r.status_grupo, value: r.valor, qtd: r.qtd_contratos, fill: DONUT_COLORS[i % DONUT_COLORS.length] })),
    [statusRows],
  );

  const pipeChartData = useMemo(
    () => pipeRows.map((r) => ({ name: r.pipeline_fase, contratos: r.qtd_contratos, valor: r.total_comprado })),
    [pipeRows],
  );

  const topBarData = useMemo(
    () =>
      topCli.map((c) => ({
        name: c.cliente.length > 28 ? `${c.cliente.slice(0, 28)}…` : c.cliente,
        full: c.cliente,
        score: c.score_prioridade_medio,
        risco: c.risco_financeiro_valor + c.risco_silencioso_valor,
        oportunidade: c.oportunidade_recuperacao_valor,
      })),
    [topCli],
  );

  if (loading && !kpi) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="animate-spin text-sl-navy" size={32} />
        <span className="text-sm font-medium">Carregando central da carteira…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-10 animate-in fade-in duration-300">
      <header className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#0f2744] via-[#1e3a5f] to-[#152a45] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Renovação & recuperação</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Carteira prioritária</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Priorize renovações, win-back e risco silencioso. Dados filtrados por validade no período — sem recálculo no navegador.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/20">
            <Sparkles className="size-5 text-amber-300" aria-hidden />
            <span className="text-xs font-semibold text-white/90">Visão executiva</span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl bg-black/15 p-4 ring-1 ring-white/10">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/60">Início (validade)</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/60">Fim (validade)</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1">
            <label className="text-[10px] font-bold uppercase text-white/60">Busca rápida</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente ou tabela…"
              className="w-full rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-900 shadow-md transition hover:bg-amber-300"
          >
            Atualizar
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <MultiFacet label="Vendedora" options={facetV} selected={vendedores} onToggle={(v) => setVendedores((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} onClear={() => setVendedores([])} />
          <MultiFacet label="Status" options={facetS} selected={statusSel} onToggle={(v) => setStatusSel((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} onClear={() => setStatusSel([])} />
          <MultiFacet label="Cliente" options={facetC} selected={clientesSel} onToggle={(v) => setClientesSel((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} onClear={() => setClientesSel([])} />
        </div>
      </header>

      {err ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">Não foi possível carregar</p>
            <p className="text-sm">{err}</p>
          </div>
        </div>
      ) : null}

      {/* KPIs principais */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
          <Target className="size-4 text-sl-navy" aria-hidden />
          Indicadores principais
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Contratos monitorados', v: kpi?.contratos_monitorados, fmt: 'int' as const },
            { label: 'Contratos críticos', v: kpi?.contratos_criticos, fmt: 'int' as const, accent: 'rose' },
            { label: 'Contratos a recuperar', v: kpi?.contratos_recuperar, fmt: 'int' as const, accent: 'amber' },
            { label: 'Mina de ouro (win-back)', v: kpi?.mina_de_ouro_winback, fmt: 'brl' as const, accent: 'gold' },
          ].map((c) => (
            <div
              key={c.label}
              className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${
                c.accent === 'rose'
                  ? 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white'
                  : c.accent === 'amber'
                    ? 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white'
                    : c.accent === 'gold'
                      ? 'border-amber-300/90 bg-gradient-to-br from-amber-100/80 via-white to-amber-50/50'
                      : 'border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">
                {c.fmt === 'int' ? Math.round(toNum(c.v)).toLocaleString('pt-BR') : formatBrl(toNum(c.v))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* KPIs secundários */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Saúde da carteira</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Carteira saudável', v: kpi?.carteira_saudavel_percentual, fmt: 'pct' as const },
            { label: 'Risco silencioso', v: kpi?.risco_silencioso_valor, fmt: 'brl' as const },
            { label: 'Contratos sem dono', v: kpi?.contratos_sem_dono, fmt: 'int' as const },
            { label: 'Ticket médio da carteira', v: kpi?.ticket_medio_carteira, fmt: 'brl2' as const },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">{c.label}</p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {c.fmt === 'pct'
                  ? formatPct01(toNum(c.v))
                  : c.fmt === 'int'
                    ? Math.round(toNum(c.v)).toLocaleString('pt-BR')
                    : c.fmt === 'brl2'
                      ? formatBrl2(toNum(c.v))
                      : formatBrl(toNum(c.v))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md">
          <h3 className="text-base font-black text-slate-900">Risco financeiro por vendedora</h3>
          <p className="text-xs text-slate-500">Risco financeiro + risco silencioso (R$). Ordenado do maior para o menor.</p>
          <div className="mt-4 h-[320px]">
            {riscoRows.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={riscoRows} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatBrl(v)} fontSize={11} />
                  <YAxis type="category" dataKey="vendedor" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: number) => formatBrl2(val)}
                    labelFormatter={(l) => String(l)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="risco_financeiro" name="Risco financeiro" stackId="a" fill="#c2410c" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="risco_silencioso" name="Risco silencioso" stackId="a" fill="#64748b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md">
          <h3 className="text-base font-black text-slate-900">Diagnóstico da base</h3>
          <p className="text-xs text-slate-500">Volume comprado por grupo de status.</p>
          <div className="mt-4 h-[320px]">
            {donutData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={68} outerRadius={108} paddingAngle={2}>
                    {donutData.map((e, i) => (
                      <Cell key={i} fill={e.fill} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatBrl2(v)}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md xl:col-span-2">
          <h3 className="text-base font-black text-slate-900">Clientes prioritários</h3>
          <p className="text-xs text-slate-500">Score de prioridade, risco e oportunidade de recuperação.</p>
          <div className="mt-4 h-[340px]">
            {topBarData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBarData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                  <XAxis type="number" dataKey="score" fontSize={11} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(15, 39, 69, 0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const p = payload[0].payload as (typeof topBarData)[0];
                      const full = topCli.find((x) => x.cliente === p.full);
                      return (
                        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
                          <p className="font-bold text-slate-900">{p.full}</p>
                          {full ? (
                            <ul className="mt-2 space-y-1 text-slate-600">
                              <li>Última compra: {formatDateBr(full.ultima_compra)}</li>
                              <li>CTEs: {full.qtd_ctes.toLocaleString('pt-BR')}</li>
                              <li>Volumes: {full.total_volumes.toLocaleString('pt-BR')}</li>
                              <li>Risco fin.: {formatBrl2(full.risco_financeiro_valor)}</li>
                              <li>Risco sil.: {formatBrl2(full.risco_silencioso_valor)}</li>
                              <li>Oportunidade: {formatBrl2(full.oportunidade_recuperacao_valor)}</li>
                              <li className="font-semibold text-sl-navy">Ação: {full.proxima_acao || '—'}</li>
                            </ul>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="score"
                    name="Score"
                    fill="#1e3a5f"
                    radius={[0, 6, 6, 0]}
                    className="cursor-pointer"
                    onClick={(data: unknown) => {
                      const row = data as { full?: string };
                      if (row?.full) void openDrill(row.full);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md xl:col-span-2">
          <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
            <TrendingUp className="size-5 text-emerald-600" aria-hidden />
            Pipeline de renovação
          </h3>
          <p className="text-xs text-slate-500">Contratos por fase de vencimento.</p>
          <div className="mt-4 h-[280px]">
            {pipeChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeChartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={70} />
                  <YAxis tickFormatter={(v) => `${v}`} fontSize={11} />
                  <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                  <Bar dataKey="contratos" name="Contratos" fill="#0d9488" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Carteira detalhada</h3>
            <p className="text-xs text-slate-500">Ordenação: prioridade de status, score e dias para vencer.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportXlsx()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sl-navy/25 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" strokeWidth={2} aria-hidden />}
              Exportar planilha (XLSX)
            </button>
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - 80))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={(tableRows.length || 0) < 80}
              onClick={() => setOffset((o) => o + 80)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
        {exportErr ? (
          <p className="border-b border-rose-100 bg-rose-50/90 px-5 py-2 text-sm text-rose-800">{exportErr}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Próxima ação</th>
                <th className="px-4 py-3">Dias p/ vencer</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tabela</th>
                <th className="px-4 py-3">Última compra</th>
                <th className="px-4 py-3">LTV</th>
                <th className="px-4 py-3">Qtd. CTEs</th>
                <th className="px-4 py-3">Volumes</th>
                <th className="px-4 py-3">Ticket médio</th>
                <th className="px-4 py-3">Vendedora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row, idx) => {
                const cliente = String(row.cliente ?? '');
                return (
                  <tr key={`${cliente}-${idx}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(String(row.status_atual ?? ''))}`}>
                        {String(row.status_atual ?? '—')}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={String(row.proxima_acao ?? '')}>
                      {String(row.proxima_acao ?? '—')}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-800">{String(row.dias_p_vencer ?? '—')}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="font-semibold text-sl-navy underline-offset-2 hover:underline" onClick={() => void openDrill(cliente)}>
                        {cliente}
                      </button>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-slate-600" title={String(row.tabela ?? '')}>
                      {String(row.tabela ?? '—')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateBr(row.ultima_compra)}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-slate-900">{formatBrl2(toNum(row.ltv_valor))}</td>
                    <td className="px-4 py-3 tabular-nums">{String(row.qtd_ctes ?? '—')}</td>
                    <td className="px-4 py-3 tabular-nums">{String(row.total_volumes ?? '—')}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{formatBrl2(toNum(row.media_ticket))}</td>
                    <td className="px-4 py-3 text-slate-700">{String(row.vendedor ?? '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableMeta ? (
          <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
            Página {Math.floor(offset / 80) + 1} · até {tableRows.length} linhas
          </p>
        ) : null}
      </section>

      {drillCliente ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Detalhe do cliente</p>
                <h4 className="text-lg font-black text-slate-900">{drillCliente}</h4>
              </div>
              <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setDrillCliente(null)} aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {drillLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-sl-navy" size={28} />
                </div>
              ) : drillRows.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma linha para este cliente no período.</p>
              ) : (
                <ul className="space-y-4">
                  {drillRows.map((r, i) => (
                    <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${statusBadgeClass(String(r.status_atual ?? ''))}`}>
                          {String(r.status_atual ?? '—')}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{String(r.tabela ?? '')}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{String(r.proxima_acao ?? '—')}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <div>
                          <dt className="font-bold text-slate-500">Validade</dt>
                          <dd>{formatDateBr(r.validade)}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">Última compra</dt>
                          <dd>{formatDateBr(r.ultima_compra)}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">Dias p/ vencer</dt>
                          <dd>{String(r.dias_vencimento ?? '—')}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">LTV</dt>
                          <dd>{formatBrl2(toNum(r.ltv_valor))}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">CTEs / volumes</dt>
                          <dd>
                            {String(r.qtd_ctes ?? '—')} / {String(r.total_volumes ?? '—')}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">Ticket médio</dt>
                          <dd>{formatBrl2(toNum(r.media_ticket))}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">Pipeline</dt>
                          <dd>{String(r.pipeline_fase ?? '—')}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">Dias sem compra</dt>
                          <dd>{r.dias_sem_compra != null ? String(r.dias_sem_compra) : '—'}</dd>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <dt className="font-bold text-slate-500">Vendedora</dt>
                          <dd>{String(r.vendedor ?? '—')}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
