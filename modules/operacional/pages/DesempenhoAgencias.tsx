'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { AlertCircle, Download, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { CollapsibleMultiSelectWithFilter } from '@/modules/bi/components/CollapsibleMultiSelectWithFilter';
import { defaultDesempenhoAgenciasRange } from '@/modules/bi/desempenhoAgencias/config';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';
import type {
  DesempenhoAgenciasDataset,
  DesempenhoAgenciasDrill,
  DesempenhoAgenciasFacets,
  DesempenhoAgenciasTableRow,
} from '@/modules/bi/desempenhoAgencias/types';

const NAVY = '#1e3a5f';
const TEAL = '#0d9488';
const AMBER = '#d97706';
const SLATE = '#64748b';

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

function formatPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatKg(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
}

type SortKey = keyof DesempenhoAgenciasTableRow;
type SortDir = 'asc' | 'desc';

function KpiCard({
  label,
  value,
  hint,
  sub,
}: {
  label: string;
  value: string;
  hint?: string;
  sub?: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm"
      title={hint ?? label}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-sl-navy/[0.06]" aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function DesempenhoAgenciasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const def = useMemo(() => defaultDesempenhoAgenciasRange(), []);

  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [selAgencias, setSelAgencias] = useState<string[]>([]);
  const [selRotas, setSelRotas] = useState<string[]>([]);
  const [selTipos, setSelTipos] = useState<string[]>([]);

  const [facets, setFacets] = useState<DesempenhoAgenciasFacets>({ agencias: [], rotas: [], tiposFrete: [] });
  const [dataset, setDataset] = useState<DesempenhoAgenciasDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFacets, setLoadingFacets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('total_ctes_origem');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [drillAgencia, setDrillAgencia] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<DesempenhoAgenciasDrill | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    const f = searchParams.get('from');
    const t = searchParams.get('to');
    const ag = searchParams.getAll('agencia').filter(Boolean);
    const ro = searchParams.getAll('rota').filter(Boolean);
    const tf = searchParams.getAll('tipo_frete').filter(Boolean);
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFrom(f);
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) setTo(t);
    if (ag.length) setSelAgencias(ag);
    if (ro.length) setSelRotas(ro);
    if (tf.length) setSelTipos(tf);
  }, [searchParams]);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoadingFacets(true);
      try {
        const j = await biGetJson<DesempenhoAgenciasFacets>('/api/bi/desempenho-agencias/facet-options');
        if (!c) setFacets(j);
      } catch {
        if (!c) setFacets({ agencias: [], rotas: [], tiposFrete: [] });
      } finally {
        if (!c) setLoadingFacets(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const queryStr = useMemo(() => {
    const q = new URLSearchParams();
    q.set('from', from);
    q.set('to', to);
    for (const a of selAgencias) q.append('agencia', a);
    for (const r of selRotas) q.append('rota', r);
    for (const t of selTipos) q.append('tipo_frete', t);
    return q.toString();
  }, [from, to, selAgencias, selRotas, selTipos]);

  const syncUrl = useCallback(() => {
    const q = new URLSearchParams();
    q.set('from', from);
    q.set('to', to);
    for (const a of selAgencias) q.append('agencia', a);
    for (const r of selRotas) q.append('rota', r);
    for (const t of selTipos) q.append('tipo_frete', t);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [from, to, selAgencias, selRotas, selTipos, pathname, router]);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await biGetJson<DesempenhoAgenciasDataset & { error?: string }>(
        `/api/bi/desempenho-agencias/dataset?${queryStr}`,
      );
      if (typeof j.error === 'string') throw new Error(j.error);
      setDataset(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar.');
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, [queryStr]);

  useEffect(() => {
    void loadDataset();
  }, [loadDataset]);

  const openDrill = useCallback(
    async (agencia: string) => {
      setDrillAgencia(agencia);
      setDrillLoading(true);
      setDrillData(null);
      try {
        const q = new URLSearchParams(queryStr);
        q.set('agencia', agencia);
        const j = await biGetJson<DesempenhoAgenciasDrill>(`/api/bi/desempenho-agencias/drill?${q.toString()}`);
        setDrillData(j);
      } catch {
        setDrillData({ summary: null, lines: [] });
      } finally {
        setDrillLoading(false);
      }
    },
    [queryStr],
  );

  const sortedTable = useMemo(() => {
    const rows = dataset?.table ?? [];
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb), 'pt-BR') * mul;
    });
  }, [dataset?.table, sortKey, sortDir]);

  const tableTotals = useMemo(() => {
    const rows = dataset?.table ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.total_ctes_origem += row.total_ctes_origem;
        acc.total_ctes_destino += row.total_ctes_destino;
        acc.total_volumes_origem += row.total_volumes_origem;
        acc.total_volumes_destino += row.total_volumes_destino;
        acc.peso_total_origem += row.peso_total_origem;
        acc.faturamento_origem += row.faturamento_origem;
        acc.qtd_coletas += row.qtd_coletas;
        acc.qtd_entregas += row.qtd_entregas;
        acc.qtd_manifestos += row.qtd_manifestos;
        acc.saldo_ctes += row.saldo_ctes;
        acc.saldo_volumes += row.saldo_volumes;
        return acc;
      },
      {
        total_ctes_origem: 0,
        total_ctes_destino: 0,
        total_volumes_origem: 0,
        total_volumes_destino: 0,
        peso_total_origem: 0,
        faturamento_origem: 0,
        qtd_coletas: 0,
        qtd_entregas: 0,
        qtd_manifestos: 0,
        saldo_ctes: 0,
        saldo_volumes: 0,
      },
    );
  }, [dataset?.table]);

  const avgVolumesPerCte =
    tableTotals.total_ctes_origem > 0 ? tableTotals.total_volumes_origem / tableTotals.total_ctes_origem : 0;
  const avgPesoPerCte = tableTotals.total_ctes_origem > 0 ? tableTotals.peso_total_origem / tableTotals.total_ctes_origem : 0;
  const avgTicketPerCte =
    tableTotals.total_ctes_origem > 0 ? tableTotals.faturamento_origem / tableTotals.total_ctes_origem : 0;

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const runExportXlsx = useCallback(
    async (agenciaFoco?: string) => {
      setExporting(true);
      setExportErr(null);
      try {
        const q = new URLSearchParams(queryStr);
        if (agenciaFoco) q.set('agencia_foco', agenciaFoco);
        const res = await fetch(`/api/bi/desempenho-agencias/export-xlsx?${q.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        const cd = res.headers.get('Content-Disposition');
        const m = cd?.match(/filename="([^"]+)"/);
        a.download = m?.[1] ?? 'Desempenho_agencias.xlsx';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } catch (e) {
        setExportErr(e instanceof Error ? e.message : 'Falha ao exportar.');
      } finally {
        setExporting(false);
      }
    },
    [queryStr],
  );

  const kpis = dataset?.kpis;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-slate-50/80 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 md:text-xl">Desempenho da malha</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Central de performance operacional: produção por agência, produtividade, coletas e entregas e equilíbrio
            emissor/receptor no período.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exporting || !dataset}
            onClick={() => void runExportXlsx()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Excel (resumo + movimentos)
          </button>
          <button
            type="button"
            onClick={() => {
              syncUrl();
              void loadDataset();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sl-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sl-navy-light"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Aplicar filtros
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[140px]">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          />
        </div>
        <CollapsibleMultiSelectWithFilter
          label="Agência"
          options={facets.agencias}
          selected={selAgencias}
          onToggle={(v) => setSelAgencias((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelAgencias([])}
          clearButtonLabel="Limpar"
          detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
        />
        <CollapsibleMultiSelectWithFilter
          label="Rota"
          options={facets.rotas}
          selected={selRotas}
          onToggle={(v) => setSelRotas((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelRotas([])}
          clearButtonLabel="Limpar"
          detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
        />
        <CollapsibleMultiSelectWithFilter
          label="Tipo de frete"
          options={facets.tiposFrete}
          selected={selTipos}
          onToggle={(v) => setSelTipos((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelTipos([])}
          clearButtonLabel="Limpar"
          detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
        />
        {loadingFacets ? <span className="text-xs text-slate-500">A carregar filtros…</span> : null}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}
      {exportErr ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {exportErr}
        </div>
      ) : null}

      {loading && !dataset ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="size-5 animate-spin text-sl-navy" aria-hidden />
          A carregar indicadores…
        </div>
      ) : null}

      {kpis ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <KpiCard label="Total CTEs" value={formatInt(kpis.total_ctes)} hint="Quantidade total de operações autorizadas no período." />
          <KpiCard label="Total volumes" value={formatInt(kpis.total_volumes)} hint="Soma total de volumes movimentados." />
          <KpiCard label="Qtd coletas" value={formatInt(kpis.qtd_coletas)} hint="Quantidade de operações com cobrança de coleta." />
          <KpiCard label="Qtd entregas" value={formatInt(kpis.qtd_entregas)} hint="Quantidade de operações com cobrança de entrega." />
          <KpiCard label="Peso transportado" value={formatKg(kpis.peso_total)} hint="Soma do peso total movimentado nas operações." />
          <KpiCard label="Faturamento" value={formatBrl(kpis.faturamento_total)} hint="Valor total movimentado pelas operações autorizadas." />
          <KpiCard
            label="Volumes / CTE"
            value={kpis.volumes_por_cte.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            hint="Média de volumes por operação."
          />
          <KpiCard
            label="Ticket / CTE"
            value={formatBrl(kpis.ticket_por_cte)}
            hint="Valor médio por operação autorizada."
          />
          <KpiCard label="% CTEs com coleta" value={formatPct(kpis.pct_coleta)} hint="Percentual de operações que passaram por coleta." />
          <KpiCard label="% CTEs com entrega" value={formatPct(kpis.pct_entrega)} hint="Percentual de operações que passaram por entrega." />
          <KpiCard
            label="% CTEs com manifesto"
            value={formatPct(kpis.pct_manifesto)}
            hint="Percentual de operações vinculadas a manifesto."
            sub="Malha fiscal"
          />
        </div>
      ) : null}

      {dataset ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title="Mostra como a operação evolui ao longo do tempo.">
            <h2 className="text-sm font-bold text-slate-900">Evolução mensal operacional</h2>
            <p className="text-xs text-slate-500">CTEs, volumes, peso e faturamento por mês.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataset.evolucaoMensal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes_referencia" tick={{ fontSize: 10 }} stroke={SLATE} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} stroke={SLATE} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} stroke={SLATE} />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      if (name === 'faturamento_total') return [formatBrl(v), 'Faturamento'];
                      if (name === 'peso_total') return [formatKg(v), 'Peso'];
                      return [formatInt(v), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="l" type="monotone" dataKey="total_ctes" name="CTEs" stroke={NAVY} strokeWidth={2} dot={false} />
                  <Line yAxisId="l" type="monotone" dataKey="total_volumes" name="Volumes" stroke={TEAL} strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="peso_total" name="Peso" stroke={AMBER} strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="faturamento_total" name="Faturamento" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title="Mostra quais agências mais geram operações e valor na malha.">
            <h2 className="text-sm font-bold text-slate-900">Ranking por produção (origem)</h2>
            <p className="text-xs text-slate-500">CTEs, volumes e faturamento emitidos.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataset.ranking} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke={SLATE} />
                  <YAxis type="category" dataKey="agencia" width={100} tick={{ fontSize: 10 }} stroke={SLATE} />
                  <Tooltip formatter={(v: number) => formatInt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total_ctes_origem" name="CTEs" fill={NAVY} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="total_volumes_origem" name="Volumes" fill={TEAL} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title="Ajuda a entender a vocação operacional de cada agência.">
            <h2 className="text-sm font-bold text-slate-900">Coletas × entregas por agência</h2>
            <p className="text-xs text-slate-500">Somatório no papel de origem.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataset.coletasEntregas} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="agencia" angle={-35} textAnchor="end" interval={0} height={60} tick={{ fontSize: 9 }} stroke={SLATE} />
                  <YAxis tick={{ fontSize: 10 }} stroke={SLATE} />
                  <Tooltip formatter={(v: number) => formatInt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="qtd_coletas" name="Coletas" fill={NAVY} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="qtd_entregas" name="Entregas" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title="Mostra se a agência emite mais do que recebe ou recebe mais do que emite.">
            <h2 className="text-sm font-bold text-slate-900">Saldo operacional da malha</h2>
            <p className="text-xs text-slate-500">Saldo de CTEs e volumes (origem − destino).</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataset.saldoMalha} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="agencia" angle={-35} textAnchor="end" interval={0} height={60} tick={{ fontSize: 9 }} stroke={SLATE} />
                  <YAxis tick={{ fontSize: 10 }} stroke={SLATE} />
                  <Tooltip formatter={(v: number) => formatInt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="saldo_ctes" name="Saldo CTEs" fill={NAVY} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saldo_volumes" name="Saldo volumes" fill={AMBER} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2" title="Mostra a eficiência média das operações geradas por cada agência.">
            <h2 className="text-sm font-bold text-slate-900">Produtividade por agência (origem)</h2>
            <p className="text-xs text-slate-500">Volumes por CTE, peso por CTE e ticket (escalas distintas — ver tooltip).</p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataset.produtividade} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="agencia" angle={-30} textAnchor="end" interval={0} height={56} tick={{ fontSize: 9 }} stroke={SLATE} />
                  <YAxis tick={{ fontSize: 10 }} stroke={SLATE} />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      if (name === 'ticket_por_cte') return [formatBrl(v), 'Ticket / CTE'];
                      if (name === 'peso_por_cte') return [formatKg(v), 'Peso / CTE'];
                      return [v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), 'Volumes / CTE'];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="volumes_por_cte" name="Volumes / CTE" fill={NAVY} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="peso_por_cte" name="Peso / CTE" fill={TEAL} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ticket_por_cte" name="Ticket / CTE" fill={AMBER} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {dataset?.table?.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Painel por agência</h2>
            <p className="text-xs text-slate-500">Clique numa linha para o detalhe (drill). Ordenação: {String(sortKey)} ({sortDir}).</p>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  {(
                    [
                      ['agencia', 'Agência'],
                      ['total_ctes_origem', 'CTEs origem'],
                      ['total_ctes_destino', 'CTEs destino'],
                      ['total_volumes_origem', 'Vol. origem'],
                      ['total_volumes_destino', 'Vol. destino'],
                      ['peso_total_origem', 'Peso origem'],
                      ['faturamento_origem', 'Fat. origem'],
                      ['qtd_coletas', 'Coletas'],
                      ['qtd_entregas', 'Entregas'],
                      ['qtd_manifestos', 'Manifestos', 'Quantidade de operações vinculadas a manifesto.'],
                      ['saldo_ctes', 'Saldo CTEs', 'Diferença entre operações emitidas e recebidas pela agência.'],
                      ['saldo_volumes', 'Saldo vol.', 'Diferença entre volumes expedidos e recebidos.'],
                      ['volumes_por_cte', 'Vol./CTE'],
                      ['peso_por_cte', 'Peso/CTE', 'Peso médio movimentado por operação.'],
                      ['ticket_por_cte', 'Ticket/CTE', 'Valor médio por operação.'],
                    ] as const
                  ).map(([key, label, tip]) => (
                    <th key={key} className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        title={tip ?? ''}
                        className="font-bold text-sl-navy hover:underline"
                        onClick={() => toggleSort(key as SortKey)}
                      >
                        {label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTable.map((row) => (
                  <tr
                    key={row.agencia}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                    onClick={() => void openDrill(row.agencia)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{row.agencia}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.total_ctes_origem)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.total_ctes_destino)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.total_volumes_origem)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.total_volumes_destino)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatKg(row.peso_total_origem)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatBrl(row.faturamento_origem)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.qtd_coletas)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.qtd_entregas)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.qtd_manifestos)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.saldo_ctes)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInt(row.saldo_volumes)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.volumes_por_cte.toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.peso_por_cte.toFixed(1)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatBrl(row.ticket_por_cte)}</td>
                  </tr>
                ))}
                <tr className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100/95 font-semibold text-slate-900">
                  <td className="whitespace-nowrap px-3 py-2">Total geral</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.total_ctes_origem)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.total_ctes_destino)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.total_volumes_origem)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.total_volumes_destino)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatKg(tableTotals.peso_total_origem)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(tableTotals.faturamento_origem)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.qtd_coletas)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.qtd_entregas)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.qtd_manifestos)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.saldo_ctes)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(tableTotals.saldo_volumes)}</td>
                  <td className="px-3 py-2 tabular-nums">{avgVolumesPerCte.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{avgPesoPerCte.toFixed(1)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(avgTicketPerCte)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {drillAgencia ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          onClick={() => {
            setDrillAgencia(null);
            setDrillData(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">Drill — {drillAgencia}</h3>
                <p className="text-xs text-slate-500">
                  Pré-visualização até 500 movimentos. O Excel exporta o mesmo detalhe com limite superior na aba «Movimentos».
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void runExportXlsx(drillAgencia ?? undefined)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
                  Excel desta agência
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    setDrillAgencia(null);
                    setDrillData(null);
                  }}
                  aria-label="Fechar"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(90vh-56px)] overflow-y-auto p-4">
              {drillLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  A carregar…
                </div>
              ) : drillData?.summary ? (
                <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <KpiCard label="CTEs origem" value={formatInt(drillData.summary.total_ctes_origem)} />
                  <KpiCard label="CTEs destino" value={formatInt(drillData.summary.total_ctes_destino)} />
                  <KpiCard label="Saldo CTEs" value={formatInt(drillData.summary.saldo_ctes)} />
                  <KpiCard label="Saldo volumes" value={formatInt(drillData.summary.saldo_volumes)} />
                  <KpiCard label="Faturamento origem" value={formatBrl(drillData.summary.faturamento_origem)} />
                  <KpiCard
                    label="Coletas / entregas"
                    value={`${formatInt(drillData.summary.qtd_coletas)} / ${formatInt(drillData.summary.qtd_entregas)}`}
                  />
                  <KpiCard label="Manifestos" value={formatInt(drillData.summary.qtd_manifestos)} />
                  <KpiCard label="Ticket / CTE" value={formatBrl(drillData.summary.ticket_por_cte)} />
                </div>
              ) : (
                <p className="text-sm text-slate-600">Sem dados agregados para esta agência no período.</p>
              )}
              <div className="overflow-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-2 py-2">CTE</th>
                      <th className="px-2 py-2">Emissão</th>
                      <th className="px-2 py-2">Origem</th>
                      <th className="px-2 py-2">Destino</th>
                      <th className="px-2 py-2">Vol.</th>
                      <th className="px-2 py-2">Peso</th>
                      <th className="px-2 py-2">Valor</th>
                      <th className="px-2 py-2">C/E/M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(drillData?.lines ?? []).map((ln) => (
                      <tr key={String(ln.id_unico)} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">{String(ln.id_unico ?? '')}</td>
                        <td className="px-2 py-1.5">{String(ln.data_referencia ?? '').slice(0, 10)}</td>
                        <td className="px-2 py-1.5">{String(ln.agencia_origem ?? '')}</td>
                        <td className="px-2 py-1.5">{String(ln.agencia_destino ?? '')}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatInt(Number(ln.volumes ?? 0))}</td>
                        <td className="px-2 py-1.5 tabular-nums">{Number(ln.peso ?? 0).toFixed(1)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatBrl(Number(ln.valor_total ?? 0))}</td>
                        <td className="px-2 py-1.5">
                          {String(ln.flg_coleta ?? '')}/{String(ln.flg_entrega ?? '')}/{String(ln.flg_manifesto ?? '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
