'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Download, Loader2, SlidersHorizontal, Target } from 'lucide-react';
import { CollapsibleMultiSelectWithFilter } from '@/modules/bi/components/CollapsibleMultiSelectWithFilter';
import { Comercial360HelpHint } from '@/modules/gerencial/comercial360/Comercial360HelpHint';
import type { PlanejamentoAtualRow, PlanejamentoReadyRow } from '@/modules/bi/planejamentoAgencias/types';
import {
  PLANEJAMENTO_DEFAULT_FROM,
  PLANEJAMENTO_DEFAULT_TO,
} from '@/modules/bi/planejamentoAgencias/config';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';

const NAVY = '#1e3a5f';
const TEAL = '#0d9488';
const AMBER = '#d97706';
const PIE_COLORS = [NAVY, TEAL, AMBER, '#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6', '#64748b'];

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function metaMes(r: PlanejamentoReadyRow, growthDec: number): number {
  return r.media_diaria_ano_base * r.dias_uteis_ano_meta * (1 + growthDec);
}

function desafioFromGapPct(pct: number): { label: string; cls: string; alto: boolean } {
  if (pct <= 3) return { label: 'Leve', cls: 'bg-emerald-100 text-emerald-900', alto: false };
  if (pct <= 8) return { label: 'Moderado', cls: 'bg-amber-100 text-amber-900', alto: false };
  if (pct <= 15) return { label: 'Forte', cls: 'bg-orange-100 text-orange-900', alto: true };
  return { label: 'Agressivo', cls: 'bg-rose-100 text-rose-900', alto: true };
}

function sazonalidadeResumo(rows: PlanejamentoReadyRow[]): string {
  if (!rows.length) return '—';
  const scored = [...rows].sort((a, b) => b.peso_sazonal_agencia - a.peso_sazonal_agencia);
  const top = scored[0];
  const second = scored[1];
  const minP = scored[scored.length - 1]?.peso_sazonal_agencia ?? 0;
  if (top && minP > 0 && top.peso_sazonal_agencia / minP < 1.2) return 'Mais equilibrada ao longo do ano.';
  const n2 = second && second.peso_sazonal_agencia > 0.08 ? ` e ${second.mes_nome}` : '';
  return `Pico relativo em ${top?.mes_nome ?? ''}${n2}.`;
}

type ApiDataset = {
  ready: PlanejamentoReadyRow[];
  atual: PlanejamentoAtualRow[];
  anoBase: number;
  anoAtual: number;
  anoMetaDias: number;
};

export function BiPlanejamentoAgenciasDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(PLANEJAMENTO_DEFAULT_FROM);
  const [to, setTo] = useState(PLANEJAMENTO_DEFAULT_TO);
  const [selAgencias, setSelAgencias] = useState<string[]>([]);
  const [crescimentoPct, setCrescimentoPct] = useState(10);

  const [facetAg, setFacetAg] = useState<string[]>([]);
  const [ready, setReady] = useState<PlanejamentoReadyRow[]>([]);
  const [atual, setAtual] = useState<PlanejamentoAtualRow[]>([]);
  const [metaAnos, setMetaAnos] = useState({ anoBase: 2025, anoAtual: 2026, anoMetaDias: 2026 });
  const [loading, setLoading] = useState(true);
  const [loadingFacets, setLoadingFacets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const growthDec = crescimentoPct / 100;

  useEffect(() => {
    const f = searchParams.get('from');
    const t = searchParams.get('to');
    const c = searchParams.get('crescimento');
    const ag = searchParams.getAll('agencia').filter(Boolean);
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFrom(f.slice(0, 7) + '-01');
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) setTo(t.slice(0, 7) + '-01');
    if (c !== null) {
      const n = Number(c.replace(',', '.'));
      if (Number.isFinite(n) && n >= 0 && n <= 20) setCrescimentoPct(n);
    }
    if (ag.length) setSelAgencias(ag);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingFacets(true);
      try {
        const j = await biGetJson<{ agencias?: unknown[] }>('/api/bi/planejamento-agencias/facet-options');
        if (!cancelled) setFacetAg(Array.isArray(j.agencias) ? (j.agencias as string[]) : []);
      } catch {
        if (!cancelled) setFacetAg([]);
      } finally {
        if (!cancelled) setLoadingFacets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryDataset = useMemo(() => {
    const q = new URLSearchParams();
    q.set('from', from);
    q.set('to', to);
    for (const a of selAgencias) q.append('agencia', a);
    return q.toString();
  }, [from, to, selAgencias]);

  const syncUrl = useCallback(() => {
    const q = new URLSearchParams();
    q.set('from', from);
    q.set('to', to);
    q.set('crescimento', String(crescimentoPct));
    for (const a of selAgencias) q.append('agencia', a);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [from, to, crescimentoPct, selAgencias, pathname, router]);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = (await biGetJson(`/api/bi/planejamento-agencias/dataset?${queryDataset}`)) as ApiDataset & {
        error?: string;
      };
      setReady(Array.isArray(j.ready) ? j.ready : []);
      setAtual(Array.isArray(j.atual) ? j.atual : []);
      setMetaAnos({
        anoBase: Number(j.anoBase) || 2025,
        anoAtual: Number(j.anoAtual) || 2026,
        anoMetaDias: Number(j.anoMetaDias) || 2026,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setReady([]);
      setAtual([]);
    } finally {
      setLoading(false);
    }
  }, [queryDataset]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadDataset(), 280);
    return () => window.clearTimeout(id);
  }, [loadDataset]);

  useEffect(() => {
    const id = window.setTimeout(() => syncUrl(), 200);
    return () => window.clearTimeout(id);
  }, [syncUrl]);

  const exportXlsx = useCallback(async () => {
    setExporting(true);
    setExportErr(null);
    try {
      const qs = new URLSearchParams(queryDataset);
      qs.set('crescimento', String(crescimentoPct));
      const res = await fetch(`/api/bi/planejamento-agencias/export-table?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(String((j as { error?: string })?.error || res.statusText));
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? 'Planejamento_agencias.xlsx';
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
  }, [queryDataset, crescimentoPct]);

  const totals = useMemo(() => {
    let base = 0;
    let meta = 0;
    let ctes = 0;
    const diasMetaPorMes = new Map<number, number>();
    for (const r of ready) {
      base += r.faturamento_realizado;
      meta += metaMes(r, growthDec);
      ctes += r.qtd_ctes;
      diasMetaPorMes.set(r.mes_num, r.dias_uteis_ano_meta);
    }
    let atualTot = 0;
    for (const r of atual) atualTot += r.faturamento_atual;
    const totalDiasMeta = [...diasMetaPorMes.values()].reduce((s, d) => s + d, 0);
    const gap = meta - base;
    const metaDiariaRede = totalDiasMeta > 0 ? meta / totalDiasMeta : 0;
    const ticket = ctes > 0 ? base / ctes : 0;
    return { base, meta, atualTot, gap, ctes, metaDiariaRede, ticket, totalDiasMeta };
  }, [ready, atual, growthDec]);

  const byAgencia = useMemo(() => {
    const map = new Map<
      string,
      {
        agencia: string;
        base: number;
        meta: number;
        atual: number;
        ctes: number;
        trimestres: Set<number>;
      }
    >();
    for (const r of ready) {
      const k = r.agencia.trim();
      const cur = map.get(k) ?? { agencia: k, base: 0, meta: 0, atual: 0, ctes: 0, trimestres: new Set<number>() };
      cur.base += r.faturamento_realizado;
      cur.meta += metaMes(r, growthDec);
      cur.ctes += r.qtd_ctes;
      cur.trimestres.add(Math.floor((r.mes_num - 1) / 3));
      map.set(k, cur);
    }
    for (const r of atual) {
      const k = r.agencia.trim();
      const cur = map.get(k);
      if (cur) cur.atual += r.faturamento_atual;
    }
    return [...map.values()].map((row) => {
      const nTrim = Math.max(1, row.trimestres.size);
      const mediaTrim = row.base / nTrim;
      const gap = row.meta - row.base;
      const pctAjuste = row.base > 0 ? ((row.meta - row.base) / row.base) * 100 : 0;
      const ticket = row.ctes > 0 ? row.base / row.ctes : 0;
      const diasAg = new Map<number, number>();
      for (const rr of ready) {
        if (rr.agencia.trim() === row.agencia) diasAg.set(rr.mes_num, rr.dias_uteis_ano_meta);
      }
      const sumD = [...diasAg.values()].reduce((s, d) => s + d, 0);
      const metaDiaria = sumD > 0 ? row.meta / sumD : 0;
      const d = desafioFromGapPct(row.base > 0 ? (gap / row.base) * 100 : pctAjuste);
      const rowsAg = ready.filter((x) => x.agencia.trim() === row.agencia);
      return {
        ...row,
        mediaTrim,
        gap,
        pctAjuste,
        ticket,
        metaDiaria,
        desafio: d.label,
        desafioCls: d.cls,
        desafioAlto: d.alto,
        sazonal: sazonalidadeResumo(rowsAg),
      };
    });
  }, [ready, atual, growthDec]);

  const agenciasDesafioAlto = useMemo(() => byAgencia.filter((x) => x.desafioAlto).length, [byAgencia]);

  const curveMes = useMemo(() => {
    const byM = new Map<
      number,
      { mes_num: number; mes_nome: string; realizadoBase: number; realizadoAtual: number; metaSim: number }
    >();
    for (const r of ready) {
      const cur = byM.get(r.mes_num) ?? {
        mes_num: r.mes_num,
        mes_nome: r.mes_nome,
        realizadoBase: 0,
        realizadoAtual: 0,
        metaSim: 0,
      };
      cur.realizadoBase += r.faturamento_realizado;
      cur.metaSim += metaMes(r, growthDec);
      cur.mes_nome = r.mes_nome;
      byM.set(r.mes_num, cur);
    }
    for (const r of atual) {
      const cur = byM.get(r.mes_num) ?? {
        mes_num: r.mes_num,
        mes_nome: r.mes_nome || `Mês ${r.mes_num}`,
        realizadoBase: 0,
        realizadoAtual: 0,
        metaSim: 0,
      };
      cur.realizadoAtual += r.faturamento_atual;
      if (r.mes_nome) cur.mes_nome = r.mes_nome;
      byM.set(r.mes_num, cur);
    }
    return [...byM.values()].sort((a, b) => a.mes_num - b.mes_num);
  }, [ready, atual, growthDec]);

  const rankingGap = useMemo(() => {
    return [...byAgencia]
      .map((a) => ({
        nome: a.agencia.length > 20 ? `${a.agencia.slice(0, 18)}…` : a.agencia,
        full: a.agencia,
        gap: a.gap,
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 14);
  }, [byAgencia]);

  const pieMeta = useMemo(() => {
    const sorted = [...byAgencia].sort((a, b) => b.meta - a.meta);
    const top = sorted.slice(0, 7);
    const rest = sorted.slice(7);
    const restM = rest.reduce((s, x) => s + x.meta, 0);
    const out = top.map((x, i) => ({ name: x.agencia, value: x.meta, fill: PIE_COLORS[i % PIE_COLORS.length] }));
    if (restM > 0) out.push({ name: 'Demais', value: restM, fill: '#cbd5e1' });
    return out.filter((x) => x.value > 0);
  }, [byAgencia]);

  const monthlyDetail = useMemo(() => {
    return [...ready]
      .map((r) => {
        const m = metaMes(r, growthDec);
        const gap = m - r.faturamento_realizado;
        const pct = r.faturamento_realizado > 0 ? (gap / r.faturamento_realizado) * 100 : 0;
        const metaDiMes = r.dias_uteis_ano_meta > 0 ? m / r.dias_uteis_ano_meta : 0;
        return {
          mes_num: r.mes_num,
          mes_nome: r.mes_nome,
          agencia: r.agencia,
          qtd_ctes: r.qtd_ctes,
          realizadoBase: r.faturamento_realizado,
          metaSim: m,
          gap,
          pct,
          diasBase: r.dias_uteis_ano_base,
          diasMeta: r.dias_uteis_ano_meta,
          metaDiMes,
          peso: r.peso_sazonal_agencia,
        };
      })
      .sort((a, b) => (a.agencia === b.agencia ? a.mes_num - b.mes_num : a.agencia.localeCompare(b.agencia)));
  }, [ready, growthDec]);

  const heatIntensity = (gapPct: number): string => {
    if (gapPct <= 3) return 'bg-emerald-50';
    if (gapPct <= 8) return 'bg-amber-50';
    if (gapPct <= 15) return 'bg-orange-100';
    return 'bg-rose-100';
  };

  const insights = useMemo(() => {
    const out: string[] = [];
    if (!ready.length && !loading) {
      out.push('Sem linhas para o período e filtros. Ajuste o recorte ou agências.');
      return out;
    }
    out.push(
      `Cenário com ${formatPct(crescimentoPct)} de crescimento projeta meta de rede de ${formatBrl(totals.meta)} (ano base ${metaAnos.anoBase}, dias úteis meta ${metaAnos.anoMetaDias}).`,
    );
    out.push(`Meta diária média da rede: ${formatBrl(totals.metaDiariaRede)}.`);
    const topInc = [...byAgencia].sort((a, b) => b.gap - a.gap)[0];
    if (topInc && topInc.gap > 0) {
      out.push(`A agência ${topInc.agencia} concentra o maior incremento absoluto (${formatBrl(topInc.gap)}).`);
    }
    const tops = [...byAgencia].sort((a, b) => b.gap - a.gap).slice(0, 3);
    if (tops.filter((x) => x.gap > 0).length >= 2) {
      out.push(`${tops.map((x) => x.agencia).join(', ')} concentram grande parte do desafio financeiro.`);
    }
    const sazForte = byAgencia.find((a) => a.sazonal.toLowerCase().includes('pico'));
    if (sazForte) {
      out.push(`Ex.: ${sazForte.agencia} — ${sazForte.sazonal}`);
    }
    return out;
  }, [ready.length, loading, crescimentoPct, totals, byAgencia, metaAnos]);

  const presets: { v: number; label: string }[] = [
    { v: 0, label: '0% Conservador' },
    { v: 5, label: '5% Base' },
    { v: 10, label: '10% Acelerado' },
    { v: 15, label: '15% Agressivo' },
    { v: 20, label: '20% Expansão' },
  ];

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-white to-slate-50/90 pb-16 pt-2">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-6 px-4 md:px-6">
        <header className="rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white via-slate-50/80 to-white px-5 py-6 shadow-[0_12px_40px_rgba(30,58,95,0.1)] md:px-8 md:py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sl-red">Gerencial · Metas</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">Planejamento estratégico das agências</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Simulador executivo sobre <code className="rounded bg-slate-100 px-1 text-xs">bi.vw_planejamento_agencias_ready</code>:{' '}
            <span className="font-medium text-slate-800">
              meta mês = média diária ano base × dias úteis ano meta × (1 + crescimento)
            </span>
            . Realizado atual em <span className="font-semibold">{metaAnos.anoAtual}</span> (mesmo recorte de meses que o ano base). Sem recalcular dias úteis fora do BI.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col flex-wrap gap-3 md:flex-row md:items-end">
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">De (mês)</span>
              <input
                type="month"
                value={from.slice(0, 7)}
                onChange={(e) => setFrom(`${e.target.value}-01`)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Até (mês)</span>
              <input
                type="month"
                value={to.slice(0, 7)}
                onChange={(e) => setTo(`${e.target.value}-01`)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <CollapsibleMultiSelectWithFilter
              label="Agência"
              options={facetAg}
              selected={selAgencias}
              onToggle={(v) => setSelAgencias((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
              onClear={() => setSelAgencias([])}
              allSummaryLabel="Todas"
              selectedSuffix="agência(s)"
              clearButtonLabel="Limpar"
              detailsClassName="group relative min-w-[min(100%,220px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
            />
            {loadingFacets ? (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="size-4 animate-spin" /> Agências…
              </span>
            ) : null}
          </div>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SlidersHorizontal className="size-5 text-sl-navy" aria-hidden />
              <span className="text-sm font-semibold text-slate-800">Crescimento aplicado</span>
              <span className="rounded-full bg-sl-navy px-3 py-1 text-sm font-bold text-white">{formatPct(crescimentoPct)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={crescimentoPct}
              onChange={(e) => setCrescimentoPct(Number(e.target.value))}
              className="mt-3 w-full accent-sl-navy"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setCrescimentoPct(p.v)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    crescimentoPct === p.v ? 'border-sl-navy bg-sl-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-sl-navy/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {exportErr ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <span>{exportErr}</span>
          </div>
        ) : null}

        {loading && !ready.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-600">
            <Loader2 className="size-8 animate-spin text-sl-navy" />
            <span className="text-sm">Carregando planejamento…</span>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Realizado ano base',
                  value: formatBrl(totals.base),
                  hint: 'Faturamento efetivamente realizado no ano usado como referência da projeção.',
                },
                {
                  title: 'Meta simulada',
                  value: formatBrl(totals.meta),
                  hint: 'Meta futura calculada com base no histórico da agência, dias úteis do ano projetado e crescimento aplicado.',
                },
                {
                  title: 'Realizado atual',
                  value: formatBrl(totals.atualTot),
                  hint: 'Faturamento já realizado no ano corrente dentro do período filtrado.',
                },
                {
                  title: 'Gap financeiro simulado',
                  value: formatBrl(totals.gap),
                  hint: 'Diferença entre a meta simulada e o realizado de referência. Mostra o tamanho do desafio.',
                },
                {
                  title: 'Crescimento aplicado',
                  value: formatPct(crescimentoPct),
                  hint: 'Percentual usado no simulador para projetar a nova meta.',
                },
                {
                  title: 'Meta diária da rede',
                  value: formatBrl(totals.metaDiariaRede),
                  hint: 'Valor médio que a rede precisa entregar por dia útil para sustentar a meta simulada.',
                },
                {
                  title: 'Ticket médio da rede',
                  value: formatBrl(totals.ticket),
                  hint: 'Valor médio por operação das agências no período base.',
                },
                {
                  title: 'Agências com desafio alto',
                  value: String(agenciasDesafioAlto),
                  hint: 'Quantidade de agências cuja meta projetada exige esforço mais agressivo (nível Forte ou Agressivo).',
                },
              ].map((k) => (
                <div key={k.title} className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{k.title}</p>
                    <Comercial360HelpHint label={k.title} body={k.hint} className="shrink-0" />
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 md:text-2xl">{k.value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-sl-navy">Curva de tendência da rede</h2>
                  <p className="mt-1 text-xs text-slate-500">Compara histórico, andamento atual e nova meta projetada da rede.</p>
                </div>
                <Comercial360HelpHint
                  label="Curva de tendência da rede"
                  body="Compara histórico, andamento atual e nova meta projetada da rede."
                />
              </div>
              <div className="mt-4 h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveMes} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes_nome" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tickFormatter={(v) => formatBrl(Number(v))} width={76} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatBrl(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="realizadoBase" name={`Realizado ${metaAnos.anoBase}`} stroke={NAVY} strokeWidth={2} dot />
                    <Line type="monotone" dataKey="realizadoAtual" name={`Realizado ${metaAnos.anoAtual}`} stroke={AMBER} strokeWidth={2} dot />
                    <Line type="monotone" dataKey="metaSim" name="Meta simulada" stroke={TEAL} strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-sl-navy">Detalhamento estratégico por agência</h2>
                  <p className="mt-1 text-xs text-slate-500">Resumo consolidado no período filtrado.</p>
                </div>
                <button
                  type="button"
                  disabled={exporting || (!ready.length && !atual.length)}
                  onClick={() => void exportXlsx()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sl-navy/25 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={2} />}
                  Exportar planilha (XLSX)
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                A planilha inclui as abas &quot;Por agência&quot; e &quot;Mensal detalhado&quot;, com o mesmo crescimento aplicado ({formatPct(crescimentoPct)}).
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-2">Agência</th>
                      <th className="py-2 pr-2">Realizado ano base</th>
                      <th className="py-2 pr-2">Média trimestral</th>
                      <th className="py-2 pr-2">Meta simulada</th>
                      <th className="py-2 pr-2">Ajuste simulado (%)</th>
                      <th className="py-2 pr-2">Gap financeiro</th>
                      <th className="py-2 pr-2">Realizado atual</th>
                      <th className="py-2 pr-2">Qtd CT-es</th>
                      <th className="py-2 pr-2">Ticket médio</th>
                      <th className="py-2 pr-2">Meta diária</th>
                      <th className="py-2 pr-2">Sazonalidade</th>
                      <th className="py-2">Desafio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAgencia.map((a) => (
                      <tr key={a.agencia} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-medium text-slate-900">{a.agencia}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.base)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.mediaTrim)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.meta)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatPct(a.pctAjuste)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.gap)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.atual)}</td>
                        <td className="py-2 pr-2 tabular-nums">{a.ctes}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.ticket)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(a.metaDiaria)}</td>
                        <td className="py-2 pr-2 max-w-[200px] text-xs text-slate-600" title={a.sazonal}>
                          {a.sazonal}
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${a.desafioCls}`}>{a.desafio}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-sl-navy">Ranking de gap financeiro</h2>
                    <p className="mt-1 text-xs text-slate-500">Agências ordenadas por gap (meta − base).</p>
                  </div>
                  <Comercial360HelpHint
                    label="Ranking de gap"
                    body="Mostra quais agências absorvem maior esforço adicional na nova meta."
                  />
                </div>
                <div className="mt-4 h-[min(400px,48vh)] w-full min-w-0">
                  {rankingGap.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingGap} layout="vertical" margin={{ left: 4, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tickFormatter={(v) => formatBrl(Number(v))} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(v: number) => formatBrl(Number(v))}
                          labelFormatter={(_, p) => (p?.[0]?.payload?.full as string) ?? ''}
                        />
                        <Bar dataKey="gap" name="Gap" radius={[0, 6, 6, 0]}>
                          {rankingGap.map((_, i) => (
                            <Cell key={i} fill={i < 3 ? TEAL : '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-12 text-center text-sm text-slate-400">Sem dados.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-sl-navy">Distribuição da meta simulada</h2>
                    <p className="mt-1 text-xs text-slate-500">Participação de cada agência na meta total.</p>
                  </div>
                  <Comercial360HelpHint
                    label="Distribuição da meta"
                    body="Ajuda a entender o peso de cada agência dentro da meta da rede."
                  />
                </div>
                <div className="mt-4 h-[min(400px,48vh)] w-full min-w-0">
                  {pieMeta.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieMeta} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={108}>
                          {pieMeta.map((_, i) => (
                            <Cell key={i} fill={pieMeta[i]?.fill ?? NAVY} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBrl(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-12 text-center text-sm text-slate-400">Sem dados.</p>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Target className="size-5 text-sl-navy" aria-hidden />
                <h2 className="text-base font-bold text-sl-navy">Matriz de desafio</h2>
                <Comercial360HelpHint
                  label="Matriz de desafio"
                  body="Mostra o grau de esforço necessário para a agência atingir a meta simulada, com base no gap e na intensidade relativa."
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-2">Agência</th>
                      <th className="py-2 pr-2">Histórico (base)</th>
                      <th className="py-2 pr-2">Meta simulada</th>
                      <th className="py-2 pr-2">Crescimento</th>
                      <th className="py-2 pr-2">Gap</th>
                      <th className="py-2">Intensidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAgencia.map((a) => {
                      const gapPct = a.base > 0 ? (a.gap / a.base) * 100 : a.pctAjuste;
                      return (
                        <tr key={a.agencia} className="border-b border-slate-100">
                          <td className="py-2 pr-2 font-medium">{a.agencia}</td>
                          <td className="py-2 pr-2 tabular-nums">{formatBrl(a.base)}</td>
                          <td className="py-2 pr-2 tabular-nums">{formatBrl(a.meta)}</td>
                          <td className="py-2 pr-2 tabular-nums">{formatPct(crescimentoPct)}</td>
                          <td className={`py-2 pr-2 tabular-nums ${heatIntensity(gapPct)}`}>{formatBrl(a.gap)}</td>
                          <td className="py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${a.desafioCls}`}>{a.desafio}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-sl-navy">Tabela mensal detalhada</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-2">Mês</th>
                      <th className="py-2 pr-2">Agência</th>
                      <th className="py-2 pr-2">Qtd CT-es</th>
                      <th className="py-2 pr-2">Realizado ano base</th>
                      <th className="py-2 pr-2">Meta simulada</th>
                      <th className="py-2 pr-2">Gap</th>
                      <th className="py-2 pr-2">% crescimento</th>
                      <th className="py-2 pr-2">Dias úteis base</th>
                      <th className="py-2 pr-2">Dias úteis meta</th>
                      <th className="py-2 pr-2">Meta diária mês</th>
                      <th className="py-2">Peso sazonal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyDetail.map((r, i) => (
                      <tr key={`${r.agencia}-${r.mes_nome}-${i}`} className="border-b border-slate-100">
                        <td className="py-2 pr-2 capitalize">{r.mes_nome}</td>
                        <td className="py-2 pr-2 font-medium">{r.agencia}</td>
                        <td className="py-2 pr-2 tabular-nums">{r.qtd_ctes}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(r.realizadoBase)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(r.metaSim)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(r.gap)}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatPct(r.pct)}</td>
                        <td className="py-2 pr-2 tabular-nums">{r.diasBase}</td>
                        <td className="py-2 pr-2 tabular-nums">{r.diasMeta}</td>
                        <td className="py-2 pr-2 tabular-nums">{formatBrl(r.metaDiMes)}</td>
                        <td className="py-2 tabular-nums text-slate-700">
                          {(r.peso * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-amber-950">Insights automáticos</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-amber-950/90">
                {insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
