'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ChevronDown, ChevronRight, Download, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { CollapsibleMultiSelectWithFilter } from '@/modules/bi/components/CollapsibleMultiSelectWithFilter';
import { RotasOperacionaisCidadesMap, type RotasMapPonto } from '@/modules/operacional/maps/RotasOperacionaisCidadesMap';
import { defaultRotasOperacionaisRange } from '@/modules/bi/rotasOperacionais/config';
import type {
  RotasHierarquiaNode,
  RotasOperacionaisDataset,
  RotasOperacionaisDrill,
  RotasOperacionaisFacets,
} from '@/modules/bi/rotasOperacionais/types';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';

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

function formatKg(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
}

function KpiCard({ label, value, hint, sub }: { label: string; value: string; hint?: string; sub?: string }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm"
      title={hint ?? label}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-emerald-700/[0.06]" aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function buildChildMap(nodes: RotasHierarquiaNode[]): Map<string | null, RotasHierarquiaNode[]> {
  const m = new Map<string | null, RotasHierarquiaNode[]>();
  for (const n of nodes) {
    const k = n.parentId;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(n);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => b.faturamento_total - a.faturamento_total);
  }
  return m;
}

function flattenVisible(children: Map<string | null, RotasHierarquiaNode[]>, expanded: Set<string>): RotasHierarquiaNode[] {
  const out: RotasHierarquiaNode[] = [];
  const walk = (pid: string | null) => {
    for (const n of children.get(pid) ?? []) {
      out.push(n);
      if (n.nivel < 3 && expanded.has(n.id)) walk(n.id);
    }
  };
  walk(null);
  return out;
}

export function RotasOperacionaisPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const def = useMemo(() => defaultRotasOperacionaisRange(), []);

  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [selAgencias, setSelAgencias] = useState<string[]>([]);
  const [selCidades, setSelCidades] = useState<string[]>([]);
  const [selFaixas, setSelFaixas] = useState<string[]>([]);
  const [selRotas, setSelRotas] = useState<string[]>([]);

  const [facets, setFacets] = useState<RotasOperacionaisFacets>({
    agencias: [],
    cidadesDestino: [],
    rotas: [],
    faixasPeso: [],
  });
  const [dataset, setDataset] = useState<RotasOperacionaisDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFacets, setLoadingFacets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const [drillKey, setDrillKey] = useState<{ ag: string; cd: string; ro: string } | null>(null);
  const [drillData, setDrillData] = useState<RotasOperacionaisDrill | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const [mapPoints, setMapPoints] = useState<RotasMapPonto[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    const f = searchParams.get('from');
    const t = searchParams.get('to');
    const ag = searchParams.getAll('agencia').filter(Boolean);
    const cd = searchParams.getAll('cidade_destino').filter(Boolean);
    const fx = searchParams.getAll('faixa_peso').filter(Boolean);
    const ro = searchParams.getAll('rota').filter(Boolean);
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFrom(f);
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) setTo(t);
    if (ag.length) setSelAgencias(ag);
    if (cd.length) setSelCidades(cd);
    if (fx.length) setSelFaixas(fx);
    if (ro.length) setSelRotas(ro);
  }, [searchParams]);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoadingFacets(true);
      try {
        const j = await biGetJson<RotasOperacionaisFacets>('/api/bi/rotas-operacionais/facet-options');
        if (!c) setFacets(j);
      } catch {
        if (!c) setFacets({ agencias: [], cidadesDestino: [], rotas: [], faixasPeso: [] });
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
    for (const c of selCidades) q.append('cidade_destino', c);
    for (const f of selFaixas) q.append('faixa_peso', f);
    for (const r of selRotas) q.append('rota', r);
    return q.toString();
  }, [from, to, selAgencias, selCidades, selFaixas, selRotas]);

  const syncUrl = useCallback(() => {
    const q = new URLSearchParams();
    q.set('from', from);
    q.set('to', to);
    for (const a of selAgencias) q.append('agencia', a);
    for (const c of selCidades) q.append('cidade_destino', c);
    for (const f of selFaixas) q.append('faixa_peso', f);
    for (const r of selRotas) q.append('rota', r);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [from, to, selAgencias, selCidades, selFaixas, selRotas, pathname, router]);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await biGetJson<RotasOperacionaisDataset & { error?: string }>(
        `/api/bi/rotas-operacionais/dataset?${queryStr}`,
      );
      if (typeof j.error === 'string') throw new Error(j.error);
      setDataset(j);
      setExpanded(new Set());
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

  useEffect(() => {
    const cities = dataset?.mapaCidades ?? [];
    if (!cities.length) {
      setMapPoints([]);
      setGeoLoading(false);
      setGeoErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setGeoLoading(true);
      setGeoErr(null);
      try {
        const res = await fetch('/api/bi/rotas-operacionais/geocode-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cities: cities.map((c) => c.cidade_destino) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { coords?: Record<string, { lat: number; lng: number } | null> };
        const coords = j.coords ?? {};
        const pts: RotasMapPonto[] = [];
        for (const c of cities) {
          const hit = coords[c.cidade_destino];
          if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
            pts.push({
              cidade_destino: c.cidade_destino,
              lat: hit.lat,
              lng: hit.lng,
              faturamento_total: c.faturamento_total,
              total_ctes: c.total_ctes,
              peso_total: c.peso_total,
              volumes_total: c.volumes_total,
            });
          }
        }
        if (!cancelled) {
          setMapPoints(pts);
          if (pts.length < cities.length) {
            setGeoErr(
              `${cities.length - pts.length} cidade(s) sem coordenadas (nome não encontrado no geocoder).`,
            );
          } else {
            setGeoErr(null);
          }
        }
      } catch {
        if (!cancelled) {
          setMapPoints([]);
          setGeoErr('Não foi possível carregar o mapa (geocodificação).');
        }
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  const runExportXlsx = useCallback(
    async (drill?: { ag: string; cd: string; ro: string } | null) => {
      setExporting(true);
      setExportErr(null);
      try {
        const q = new URLSearchParams(queryStr);
        if (drill) {
          q.set('export_drill', '1');
          q.set('drill_agencia', drill.ag);
          q.set('drill_cidade', drill.cd);
          q.set('drill_rota', drill.ro);
        }
        const res = await fetch(`/api/bi/rotas-operacionais/export-xlsx?${q.toString()}`, {
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
        a.download = m?.[1] ?? 'Rotas_operacionais.xlsx';
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

  const openDrill = useCallback(
    async (ag: string, cd: string, ro: string) => {
      setDrillKey({ ag, cd, ro });
      setDrillLoading(true);
      setDrillData(null);
      try {
        const q = new URLSearchParams(queryStr);
        q.set('agencia_origem', ag);
        q.set('cidade_destino', cd);
        q.set('rota', ro);
        const j = await biGetJson<RotasOperacionaisDrill>(`/api/bi/rotas-operacionais/drill?${q.toString()}`);
        setDrillData(j);
      } catch {
        setDrillData({ summary: null, lines: [] });
      } finally {
        setDrillLoading(false);
      }
    },
    [queryStr],
  );

  const childMap = useMemo(() => buildChildMap(dataset?.hierarchy ?? []), [dataset?.hierarchy]);
  const visibleRows = useMemo(() => flattenVisible(childMap, expanded), [childMap, expanded]);
  const hierarchyTotals = useMemo(() => {
    const level1 = (dataset?.hierarchy ?? []).filter((r) => r.nivel === 1);
    return level1.reduce(
      (acc, row) => {
        acc.faturamento_total += row.faturamento_total;
        acc.peso_total += row.peso_total;
        acc.total_ctes += row.total_ctes;
        acc.volumes_total += row.volumes_total;
        return acc;
      },
      { faturamento_total: 0, peso_total: 0, total_ctes: 0, volumes_total: 0 },
    );
  }, [dataset?.hierarchy]);
  const hierarchyTicketMedio =
    hierarchyTotals.total_ctes > 0 ? hierarchyTotals.faturamento_total / hierarchyTotals.total_ctes : 0;

  const kpis = dataset?.kpis;
  const mapaTotal = dataset?.mapaCidades?.length ?? 0;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-slate-50/80 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 md:text-xl">Rotas operacionais</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Inteligência territorial da malha: origem (coleta), destino, rota, peso e faturamento. Dados em tempo real a
            partir da base consolidada de CTEs autorizados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exporting || !dataset}
            onClick={() => void runExportXlsx(null)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Excel (painel completo)
          </button>
          <button
            type="button"
            onClick={() => {
              syncUrl();
              void loadDataset();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900"
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
          label="Agência origem"
          options={facets.agencias}
          selected={selAgencias}
          onToggle={(v) => setSelAgencias((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelAgencias([])}
          clearButtonLabel="Limpar"
          checkboxClassName="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700/30"
          clearButtonClassName="text-xs font-semibold text-emerald-800 underline"
          detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
        />
        <CollapsibleMultiSelectWithFilter
          label="Cidade destino"
          options={facets.cidadesDestino}
          selected={selCidades}
          onToggle={(v) => setSelCidades((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelCidades([])}
          clearButtonLabel="Limpar"
          checkboxClassName="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700/30"
          clearButtonClassName="text-xs font-semibold text-emerald-800 underline"
          detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
        />
        <CollapsibleMultiSelectWithFilter
          label="Faixa de peso"
          options={facets.faixasPeso}
          selected={selFaixas}
          onToggle={(v) => setSelFaixas((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelFaixas([])}
          clearButtonLabel="Limpar"
          checkboxClassName="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700/30"
          clearButtonClassName="text-xs font-semibold text-emerald-800 underline"
          detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
        />
        <CollapsibleMultiSelectWithFilter
          label="Rota"
          options={facets.rotas}
          selected={selRotas}
          onToggle={(v) => setSelRotas((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          onClear={() => setSelRotas([])}
          clearButtonLabel="Limpar"
          checkboxClassName="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700/30"
          clearButtonClassName="text-xs font-semibold text-emerald-800 underline"
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
          <Loader2 className="size-5 animate-spin text-emerald-800" aria-hidden />
          A carregar indicadores…
        </div>
      ) : null}

      {kpis ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <KpiCard
            label="Faturamento total"
            value={formatBrl(kpis.faturamento_total)}
            hint="Valor total gerado pelas operações das rotas no período."
          />
          <KpiCard label="Ticket médio" value={formatBrl(kpis.ticket_medio)} hint="Valor médio por operação nas rotas analisadas." />
          <KpiCard label="Total CTEs rotas" value={formatInt(kpis.total_ctes)} hint="Quantidade total de operações nas rotas filtradas." />
          <KpiCard label="Peso total rotas" value={formatKg(kpis.peso_total)} hint="Soma do peso movimentado pelas rotas." />
          <KpiCard label="Total volumes rotas" value={formatInt(kpis.volumes_total)} hint="Soma dos volumes movimentados nas rotas." />
          <KpiCard label="Peso médio / CTE" value={formatKg(kpis.peso_medio_por_cte)} hint="Peso médio por operação." />
          <KpiCard
            label="Volumes / CTE"
            value={kpis.volumes_por_cte.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            hint="Quantidade média de volumes por operação."
          />
          <KpiCard
            label="Faturamento / kg"
            value={formatBrl(kpis.faturamento_por_kg)}
            hint="Quanto a operação gera, em média, por quilo movimentado."
            sub="R$/kg"
          />
        </div>
      ) : null}

      {dataset ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            title="Mostra quais agências mais geram valor nas rotas."
          >
            <h2 className="text-sm font-bold text-slate-900">Ranking — faturamento por agência origem</h2>
            <p className="text-xs text-slate-500">Coleta como ponto de origem operacional.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataset.rankingAgencias}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke={SLATE} tickFormatter={(v) => formatBrl(Number(v))} />
                  <YAxis type="category" dataKey="agencia_origem" width={110} tick={{ fontSize: 10 }} stroke={SLATE} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} />
                  <Bar dataKey="faturamento_total" name="Faturamento" fill={NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            title="Mostra quais destinos concentram mais faturamento."
          >
            <h2 className="text-sm font-bold text-slate-900">Ranking — faturamento por cidade destino</h2>
            <p className="text-xs text-slate-500">Principais polos de demanda no período.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataset.rankingCidades}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke={SLATE} tickFormatter={(v) => formatBrl(Number(v))} />
                  <YAxis type="category" dataKey="cidade_destino" width={120} tick={{ fontSize: 9 }} stroke={SLATE} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} />
                  <Bar dataKey="faturamento_total" name="Faturamento" fill={TEAL} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2"
            title="Concentração territorial por cidade destino (OpenStreetMap)."
          >
            <h2 className="text-sm font-bold text-slate-900">Mapa — cidades destino</h2>
            <p className="text-xs text-slate-500">
              OpenStreetMap · posição por nome da cidade (Photon). Círculos maiores = mais faturamento no período.
              {mapaTotal ? (
                <span className="ml-1 font-medium text-slate-600">
                  {mapPoints.length}/{mapaTotal} cidades no mapa.
                </span>
              ) : null}
            </p>
            {geoErr ? <p className="mt-1 text-xs text-amber-800">{geoErr}</p> : null}
            <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-100">
              {geoLoading ? (
                <div className="flex h-80 items-center justify-center gap-2 bg-slate-50 text-sm text-slate-600">
                  <Loader2 className="size-5 animate-spin text-emerald-800" aria-hidden />
                  A localizar cidades no mapa…
                </div>
              ) : (
                <RotasOperacionaisCidadesMap
                  points={mapPoints}
                  formatBrl={formatBrl}
                  formatInt={formatInt}
                  formatKg={formatKg}
                />
              )}
            </div>
          </div>

          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            title="Mostra quais rotas concentram mais valor e movimento."
          >
            <h2 className="text-sm font-bold text-slate-900">Rotas mais relevantes</h2>
            <p className="text-xs text-slate-500">Faturamento, ticket médio e volume.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataset.rankingRotas}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke={SLATE} tickFormatter={(v) => formatBrl(Number(v))} />
                  <YAxis type="category" dataKey="rota" width={120} tick={{ fontSize: 9 }} stroke={SLATE} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof dataset.rankingRotas)[0];
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                          <p className="font-semibold text-slate-900">{p.rota}</p>
                          <p className="mt-1 text-slate-600">Faturamento: {formatBrl(p.faturamento)}</p>
                          <p className="text-slate-600">Ticket: {formatBrl(p.ticket)}</p>
                          <p className="text-slate-600">Volume: {formatInt(p.volume)}</p>
                          <p className="text-slate-600">CTEs: {formatInt(p.total_ctes)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="faturamento" name="Faturamento" fill={NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            title="Ajuda a entender o mix operacional por peso transportado."
          >
            <h2 className="text-sm font-bold text-slate-900">Distribuição por faixa de peso</h2>
            <p className="text-xs text-slate-500">CTEs e faturamento por faixa.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataset.faixaPeso} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="faixa_peso" tick={{ fontSize: 9 }} stroke={SLATE} interval={0} angle={-12} textAnchor="end" height={48} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} stroke={SLATE} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} stroke={SLATE} tickFormatter={(v) => formatBrl(Number(v))} />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      if (name === 'faturamento_total') return [formatBrl(v), 'Faturamento'];
                      if (name === 'peso_total') return [formatKg(v), 'Peso'];
                      return [formatInt(v), 'CTEs'];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="total_ctes" name="CTEs" fill={NAVY} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="r" dataKey="faturamento_total" name="Faturamento" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {dataset?.hierarchy?.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Hierarquia operacional</h2>
            <p className="text-xs text-slate-500">Agência origem → cidade destino → rota. Expanda níveis; no nível rota abra o drill.</p>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Estrutura</th>
                  <th className="px-3 py-2">Faturamento</th>
                  <th className="px-3 py-2">Peso</th>
                  <th className="px-3 py-2">Ticket médio</th>
                  <th className="px-3 py-2">CTEs</th>
                  <th className="px-3 py-2">Volumes</th>
                  <th className="px-3 py-2">Faixa peso</th>
                  <th className="px-3 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const pad = (row.nivel - 1) * 14;
                  const hasKids = row.nivel < 3 && (childMap.get(row.id)?.length ?? 0) > 0;
                  const isOpen = expanded.has(row.id);
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1" style={{ paddingLeft: pad }}>
                          {hasKids ? (
                            <button
                              type="button"
                              className="rounded p-0.5 text-slate-600 hover:bg-slate-200"
                              aria-expanded={isOpen}
                              onClick={() => toggleExpand(row.id)}
                            >
                              {isOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                            </button>
                          ) : (
                            <span className="inline-block w-5" aria-hidden />
                          )}
                          <span className="font-medium text-slate-900">
                            {row.nivel === 1 ? row.agencia_origem : null}
                            {row.nivel === 2 ? row.cidade_destino : null}
                            {row.nivel === 3 ? row.rota : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatBrl(row.faturamento_total)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatKg(row.peso_total)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatBrl(row.ticket_medio)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInt(row.total_ctes)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInt(row.volumes_total)}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-600" title={row.faixa_peso ?? ''}>
                        {row.faixa_peso ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.nivel === 3 ? (
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                            onClick={() => void openDrill(row.agencia_origem, row.cidade_destino ?? '', row.rota ?? '')}
                          >
                            Drill
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                <tr className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100/95 font-semibold text-slate-900">
                  <td className="px-3 py-2">Total geral</td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(hierarchyTotals.faturamento_total)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatKg(hierarchyTotals.peso_total)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(hierarchyTicketMedio)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(hierarchyTotals.total_ctes)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInt(hierarchyTotals.volumes_total)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">—</td>
                  <td className="px-3 py-2"> </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {drillKey ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          onClick={() => {
            setDrillKey(null);
            setDrillData(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Drill — {drillKey.ag} / {drillKey.cd} / {drillKey.ro}
                </h3>
                <p className="text-xs text-slate-500">Até 500 movimentos (CTE) no período filtrado.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void runExportXlsx({ ag: drillKey.ag, cd: drillKey.cd, ro: drillKey.ro })}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
                  Excel deste drill
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    setDrillKey(null);
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
                  <KpiCard label="Agência origem" value={drillData.summary.agencia_origem} />
                  <KpiCard label="Cidade destino" value={drillData.summary.cidade_destino} />
                  <KpiCard label="Rota" value={drillData.summary.rota} />
                  <KpiCard label="Faixa predominante" value={drillData.summary.faixa_peso_predominante ?? '—'} />
                  <KpiCard label="Faturamento" value={formatBrl(drillData.summary.faturamento_total)} />
                  <KpiCard label="Peso total" value={formatKg(drillData.summary.peso_total)} />
                  <KpiCard label="Volumes" value={formatInt(drillData.summary.volumes_total)} />
                  <KpiCard label="Total CTEs" value={formatInt(drillData.summary.total_ctes)} />
                  <KpiCard label="Ticket médio" value={formatBrl(drillData.summary.ticket_medio)} />
                  <KpiCard label="Faturamento / kg" value={formatBrl(drillData.summary.faturamento_por_kg)} />
                </div>
              ) : (
                <p className="text-sm text-slate-600">Sem dados agregados para esta combinação no período.</p>
              )}
              <div className="overflow-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-2 py-2">CTE</th>
                      <th className="px-2 py-2">Emissão</th>
                      <th className="px-2 py-2">Origem</th>
                      <th className="px-2 py-2">Destino</th>
                      <th className="px-2 py-2">Rota</th>
                      <th className="px-2 py-2">Faixa</th>
                      <th className="px-2 py-2">Vol.</th>
                      <th className="px-2 py-2">Peso</th>
                      <th className="px-2 py-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(drillData?.lines ?? []).map((ln) => (
                      <tr key={String(ln.id_unico)} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">{String(ln.id_unico ?? '')}</td>
                        <td className="px-2 py-1.5">{String(ln.data_referencia ?? '').slice(0, 10)}</td>
                        <td className="px-2 py-1.5">{String(ln.agencia_origem ?? '')}</td>
                        <td className="px-2 py-1.5">{String(ln.cidade_destino ?? '')}</td>
                        <td className="px-2 py-1.5">{String(ln.rota ?? '')}</td>
                        <td className="px-2 py-1.5 text-[11px]">{String(ln.faixa_peso ?? '')}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatInt(Number(ln.volumes ?? 0))}</td>
                        <td className="px-2 py-1.5 tabular-nums">{Number(ln.peso ?? 0).toFixed(1)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatBrl(Number(ln.valor_total ?? 0))}</td>
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
