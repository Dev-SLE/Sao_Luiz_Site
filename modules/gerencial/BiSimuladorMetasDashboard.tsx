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
import { AlertCircle, Loader2, SlidersHorizontal } from 'lucide-react';
import { CollapsibleMultiSelectWithFilter } from '@/modules/bi/components/CollapsibleMultiSelectWithFilter';
import { Comercial360HelpHint } from '@/modules/gerencial/comercial360/Comercial360HelpHint';
import type { SimuladorMesRow } from '@/modules/bi/simuladorMetas/types';
import {
  SIMULADOR_METAS_DEFAULT_FROM,
  SIMULADOR_METAS_DEFAULT_TO,
} from '@/modules/bi/simuladorMetas/config';
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

function desafioLabel(pctIncremental: number): { label: string; cls: string } {
  if (pctIncremental <= 3) return { label: 'Leve', cls: 'bg-emerald-100 text-emerald-900' };
  if (pctIncremental <= 8) return { label: 'Moderado', cls: 'bg-amber-100 text-amber-900' };
  if (pctIncremental <= 15) return { label: 'Forte', cls: 'bg-orange-100 text-orange-900' };
  return { label: 'Agressivo', cls: 'bg-rose-100 text-rose-900' };
}

function metaMes(r: SimuladorMesRow, growthDec: number): number {
  return r.media_diaria_2025 * r.dias_uteis_2026 * (1 + growthDec);
}

export function BiSimuladorMetasDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(SIMULADOR_METAS_DEFAULT_FROM);
  const [to, setTo] = useState(SIMULADOR_METAS_DEFAULT_TO);
  const [selVendedores, setSelVendedores] = useState<string[]>([]);
  const [selTipos, setSelTipos] = useState<string[]>([]);
  const [crescimentoPct, setCrescimentoPct] = useState(8);

  const [facetV, setFacetV] = useState<string[]>([]);
  const [facetT, setFacetT] = useState<string[]>([]);
  const [rows, setRows] = useState<SimuladorMesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFacets, setLoadingFacets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const growthDec = crescimentoPct / 100;

  useEffect(() => {
    const f = searchParams.get('from');
    const t = searchParams.get('to');
    const c = searchParams.get('crescimento');
    const vs = searchParams.getAll('vendedor').filter(Boolean);
    const ts = searchParams.getAll('tipo_comissao').filter(Boolean);
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFrom(f.slice(0, 7) + '-01');
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) setTo(t.slice(0, 7) + '-01');
    if (c !== null) {
      const n = Number(c.replace(',', '.'));
      if (Number.isFinite(n) && n >= 0 && n <= 20) setCrescimentoPct(n);
    }
    if (vs.length) setSelVendedores(vs);
    if (ts.length) setSelTipos(ts);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingFacets(true);
      try {
        const j = await biGetJson<{ vendedores?: unknown[]; tiposComissao?: unknown[] }>(
          '/api/bi/simulador-metas/facet-options',
        );
        if (!cancelled) {
          setFacetV(Array.isArray(j.vendedores) ? (j.vendedores as string[]) : []);
          setFacetT(Array.isArray(j.tiposComissao) ? (j.tiposComissao as string[]) : []);
        }
      } catch {
        if (!cancelled) {
          setFacetV([]);
          setFacetT([]);
        }
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
    for (const v of selVendedores) q.append('vendedor', v);
    for (const t of selTipos) q.append('tipo_comissao', t);
    return q.toString();
  }, [from, to, selVendedores, selTipos]);

  const syncUrl = useCallback(() => {
    const q = new URLSearchParams();
    q.set('from', from);
    q.set('to', to);
    q.set('crescimento', String(crescimentoPct));
    for (const v of selVendedores) q.append('vendedor', v);
    for (const t of selTipos) q.append('tipo_comissao', t);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [from, to, crescimentoPct, selVendedores, selTipos, pathname, router]);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await biGetJson<{ rows?: SimuladorMesRow[]; error?: string }>(
        `/api/bi/simulador-metas/dataset?${queryDataset}`,
      );
      const r = Array.isArray(j.rows) ? (j.rows as SimuladorMesRow[]) : [];
      setRows(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setRows([]);
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

  const totals = useMemo(() => {
    let venda = 0;
    let meta = 0;
    let ctes = 0;
    const diasMes = new Map<number, number>();
    for (const r of rows) {
      venda += r.venda_realizada;
      meta += metaMes(r, growthDec);
      ctes += r.qtd_ctes_real;
      diasMes.set(r.mes_num, r.dias_uteis_2026);
    }
    const totalDias26 = [...diasMes.values()].reduce((a, b) => a + b, 0);
    const inc = meta - venda;
    const ticket = ctes > 0 ? venda / ctes : 0;
    const metaDiaria = totalDias26 > 0 ? meta / totalDias26 : 0;
    const mediaDiariaPond =
      venda > 0 ? rows.reduce((s, r) => s + r.media_diaria_2025 * r.venda_realizada, 0) / venda : 0;
    const pctInc = venda > 0 ? (inc / venda) * 100 : 0;
    return { venda, meta, inc, ctes, ticket, metaDiaria, mediaDiariaPond, totalDias26, pctInc };
  }, [rows, growthDec]);

  const bySeller = useMemo(() => {
    const m = new Map<string, { venda: number; meta: number; ctes: number }>();
    for (const r of rows) {
      const cur = m.get(r.vendedor) ?? { venda: 0, meta: 0, ctes: 0 };
      cur.venda += r.venda_realizada;
      cur.meta += metaMes(r, growthDec);
      cur.ctes += r.qtd_ctes_real;
      m.set(r.vendedor, cur);
    }
    return [...m.entries()]
      .map(([vendedor, v]) => {
        const pctInc = v.venda > 0 ? ((v.meta - v.venda) / v.venda) * 100 : 0;
        const d = desafioLabel(pctInc);
        return { vendedor, ...v, pctInc, desafio: d.label, desafioCls: d.cls };
      })
      .sort((a, b) => b.meta - a.meta);
  }, [rows, growthDec]);

  const participacaoMax = useMemo(() => {
    if (totals.meta <= 0 || !bySeller.length) return 0;
    const max = Math.max(...bySeller.map((s) => s.meta / totals.meta));
    return max * 100;
  }, [bySeller, totals.meta]);

  const seasonal = useMemo(() => {
    const byM = new Map<number, { mes_num: number; mes_nome: string; venda: number }>();
    for (const r of rows) {
      const cur = byM.get(r.mes_num) ?? { mes_num: r.mes_num, mes_nome: r.mes_nome, venda: 0 };
      cur.venda += r.venda_realizada;
      cur.mes_nome = r.mes_nome;
      byM.set(r.mes_num, cur);
    }
    return [...byM.values()].sort((a, b) => a.mes_num - b.mes_num);
  }, [rows]);

  const rankingIncremento = useMemo(() => {
    return [...bySeller]
      .map((s) => ({
        nome: s.vendedor.length > 22 ? `${s.vendedor.slice(0, 20)}…` : s.vendedor,
        full: s.vendedor,
        incremento: s.meta - s.venda,
      }))
      .filter((x) => x.incremento > 0)
      .sort((a, b) => b.incremento - a.incremento)
      .slice(0, 12);
  }, [bySeller]);

  const pieMeta = useMemo(() => {
    const top = bySeller.slice(0, 7);
    const rest = bySeller.slice(7);
    const restMeta = rest.reduce((s, x) => s + x.meta, 0);
    const out = top.map((x, i) => ({ name: x.vendedor, value: x.meta, fill: PIE_COLORS[i % PIE_COLORS.length] }));
    if (restMeta > 0) out.push({ name: 'Demais', value: restMeta, fill: '#cbd5e1' });
    return out.filter((x) => x.value > 0);
  }, [bySeller]);

  const monthlyAgg = useMemo(() => {
    const byM = new Map<number, SimuladorMesRow[]>();
    for (const r of rows) {
      const arr = byM.get(r.mes_num) ?? [];
      arr.push(r);
      byM.set(r.mes_num, arr);
    }
    return [...byM.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([mes_num, list]) => {
        const mes_nome = list[0]?.mes_nome ?? String(mes_num);
        const venda = list.reduce((s, r) => s + r.venda_realizada, 0);
        const meta = list.reduce((s, r) => s + metaMes(r, growthDec), 0);
        const d26 = list[0]?.dias_uteis_2026 ?? 0;
        return { mes_num, mes_nome, venda, meta, incremento: meta - venda, dias_uteis_2026: d26 };
      });
  }, [rows, growthDec]);

  const sazonalTexto = useMemo(() => {
    if (!seasonal.length) return 'Sem dados no período.';
    const tot = seasonal.reduce((s, x) => s + x.venda, 0);
    if (tot <= 0) return 'Faturamento zerado no período — sazonalidade indisponível.';
    const scored = seasonal
      .map((x) => ({ ...x, share: x.venda / tot }))
      .sort((a, b) => b.share - a.share);
    const top = scored[0];
    const second = scored[1];
    if (!top) return '';
    const ratio = top.venda / Math.max(scored[scored.length - 1]?.venda ?? 1, 1e-9);
    if (ratio < 1.15) return 'Distribuição mensal relativamente equilibrada (pico suave).';
    const n2 = second && second.share > 0.08 ? ` e ${second.mes_nome}` : '';
    return `Pico relativo em ${top.mes_nome}${n2} (com base no faturamento 2025 filtrado).`;
  }, [seasonal]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (rows.length === 0 && !loading) {
      out.push('Nenhuma linha retornada para os filtros. Amplie o período ou limpe vendedor / tipo de comissão.');
      return out;
    }
    out.push(
      `Meta 2026 projetada: ${formatBrl(totals.meta)} (${formatPct(crescimentoPct)} de crescimento sobre a média diária de 2025 × dias úteis 2026).`,
    );
    out.push(`Incremento agregado vs realizado 2025: ${formatBrl(totals.inc)} (${formatPct(totals.pctInc)}).`);
    if (totals.mediaDiariaPond > 0 && totals.metaDiaria > 0) {
      const rel = (totals.metaDiaria / totals.mediaDiariaPond - 1) * 100;
      out.push(`Meta diária média ponderada (2026): ${formatBrl(totals.metaDiaria)} — ${rel >= 0 ? 'acima' : 'abaixo'} da média diária 2025 ponderada em ~${formatPct(Math.abs(rel))}.`);
    }
    if (bySeller.length >= 2 && totals.meta > 0) {
      const top2 = bySeller.slice(0, 2).reduce((s, x) => s + x.meta, 0);
      const shareTop2 = (top2 / totals.meta) * 100;
      if (shareTop2 > 50) {
        out.push(`Concentração: as duas maiores vendedoras somam ~${formatPct(shareTop2)} da meta simulada.`);
      }
    }
    out.push(sazonalTexto);
    return out;
  }, [rows.length, loading, totals, crescimentoPct, bySeller, sazonalTexto]);

  const presets = [0, 5, 8, 12, 15, 20];

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-white to-slate-50/90 pb-16 pt-2">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 md:px-6">
        <header className="rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white via-slate-50/80 to-white px-5 py-6 shadow-[0_12px_40px_rgba(30,58,95,0.1)] md:px-8 md:py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sl-red">Gerencial · Metas</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">Simulador de metas vendedoras</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Projeção 2026 a partir do realizado 2025 (view <code className="rounded bg-slate-100 px-1 text-xs">bi.vw_simulador_vendedoras_ready</code>):{' '}
            <span className="font-medium text-slate-800">meta mês = média diária 2025 × dias úteis 2026 × (1 + crescimento)</span>.
            Ajuste o percentual com o slider; filtros recarregam o conjunto base automaticamente.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
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
              label="Vendedor"
              options={facetV}
              selected={selVendedores}
              onToggle={(v) =>
                setSelVendedores((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
              }
              onClear={() => setSelVendedores([])}
              clearButtonLabel="Limpar"
              detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
            />
            <CollapsibleMultiSelectWithFilter
              label="Tipo de comissão"
              options={facetT}
              selected={selTipos}
              onToggle={(v) => setSelTipos((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
              onClear={() => setSelTipos([])}
              clearButtonLabel="Limpar"
              detailsClassName="group relative min-w-[min(100%,200px)] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm open:z-30 open:shadow-md"
            />
            {loadingFacets ? (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="size-4 animate-spin" /> Filtros…
              </span>
            ) : null}
          </div>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SlidersHorizontal className="size-5 text-sl-navy" aria-hidden />
              <span className="text-sm font-semibold text-slate-800">Crescimento sobre a base 2025</span>
              <span className="rounded-full bg-sl-navy/10 px-2.5 py-0.5 text-xs font-bold text-sl-navy">
                {formatPct(crescimentoPct)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={crescimentoPct}
              onChange={(e) => setCrescimentoPct(Number(e.target.value))}
              className="mt-3 w-full accent-sl-navy"
              aria-valuemin={0}
              aria-valuemax={20}
              aria-valuenow={crescimentoPct}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCrescimentoPct(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    crescimentoPct === p
                      ? 'border-sl-navy bg-sl-navy text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-sl-navy/40'
                  }`}
                >
                  {p}%
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

        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-600">
            <Loader2 className="size-8 animate-spin text-sl-navy" />
            <span className="text-sm">Carregando simulador…</span>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Faturamento 2025 (filtro)',
                  value: formatBrl(totals.venda),
                  hint: 'Soma de venda_realizada na view mensal ready, respeitando período e facetas.',
                },
                {
                  title: 'Meta 2026 simulada',
                  value: formatBrl(totals.meta),
                  hint: 'Soma de média_diária_2025 × dias_úteis_2026 × (1 + crescimento) por linha mensal.',
                },
                {
                  title: 'Incremento vs 2025',
                  value: formatBrl(totals.inc),
                  hint: 'Meta simulada menos faturamento 2025 no mesmo recorte.',
                },
                {
                  title: '% sobre realizado',
                  value: formatPct(totals.pctInc),
                  hint: 'Incremento dividido pelo faturamento 2025 filtrado.',
                },
                {
                  title: 'CT-es no período',
                  value: String(Math.round(totals.ctes)),
                  hint: 'Soma de qtd_ctes_real das linhas retornadas.',
                },
                {
                  title: 'Ticket médio (ponderado)',
                  value: formatBrl(totals.ticket),
                  hint: 'Faturamento total / quantidade de CT-es.',
                },
                {
                  title: 'Meta diária média 2026',
                  value: formatBrl(totals.metaDiaria),
                  hint: 'Meta total simulada ÷ soma dos dias úteis 2026 dos meses distintos no filtro (sem duplicar mês).',
                },
                {
                  title: 'Maior participação na meta',
                  value: formatPct(participacaoMax),
                  hint: 'Maior fatia individual: meta da vendedora ÷ meta total simulada.',
                },
              ].map((k) => (
                <div
                  key={k.title}
                  className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{k.title}</p>
                    <Comercial360HelpHint label={k.title} body={k.hint} className="shrink-0" />
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 md:text-2xl">{k.value}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-sl-navy">Sazonalidade do faturamento 2025</h2>
                <p className="mt-1 text-xs text-slate-500">Agregado mensal no filtro atual.</p>
                <div className="mt-4 h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={seasonal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="mes_nome" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis tickFormatter={(v) => formatBrl(Number(v))} width={72} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBrl(Number(v))} />
                      <Line type="monotone" dataKey="venda" name="Faturamento" stroke={NAVY} strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-sl-navy">Distribuição da meta 2026 (por vendedora)</h2>
                <p className="mt-1 text-xs text-slate-500">Top 7 + demais.</p>
                <div className="mt-4 h-72 w-full min-w-0">
                  {pieMeta.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieMeta} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                          {pieMeta.map((_, i) => (
                            <Cell key={i} fill={pieMeta[i]?.fill ?? NAVY} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBrl(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-16 text-center text-sm text-slate-400">Sem dados para o gráfico.</p>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-sl-navy">Ranking de incremento (meta − realizado)</h2>
              <p className="mt-1 text-xs text-slate-500">Vendedoras com incremento positivo no cenário atual.</p>
              <div className="mt-4 h-[min(420px,50vh)] w-full min-w-0">
                {rankingIncremento.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingIncremento} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => formatBrl(Number(v))} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: number) => formatBrl(Number(v))}
                        labelFormatter={(_, p) => (p?.[0]?.payload?.full as string) ?? ''}
                      />
                      <Bar dataKey="incremento" name="Incremento" radius={[0, 6, 6, 0]}>
                        {rankingIncremento.map((_, i) => (
                          <Cell key={i} fill={i < 3 ? TEAL : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-slate-400">Nenhum incremento positivo (cenário 0% ou sem dados).</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-sl-navy">Por vendedora</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Vendedora</th>
                      <th className="py-2 pr-3">Realizado 2025</th>
                      <th className="py-2 pr-3">Meta 2026</th>
                      <th className="py-2 pr-3">Incremento</th>
                      <th className="py-2 pr-3">% s/ real.</th>
                      <th className="py-2">Desafio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySeller.map((s) => (
                      <tr key={s.vendedor} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-900">{s.vendedor}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{formatBrl(s.venda)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{formatBrl(s.meta)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{formatBrl(s.meta - s.venda)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{formatPct(s.pctInc)}</td>
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${s.desafioCls}`}>
                            {s.desafio}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bySeller.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">Nenhuma linha para exibir.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-sl-navy">Detalhe mensal (agregado)</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Mês</th>
                      <th className="py-2 pr-3">Dias úteis 2026</th>
                      <th className="py-2 pr-3">Faturamento 2025</th>
                      <th className="py-2 pr-3">Meta 2026</th>
                      <th className="py-2">Incremento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAgg.map((m) => (
                      <tr key={m.mes_num} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium capitalize text-slate-900">{m.mes_nome}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{m.dias_uteis_2026}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{formatBrl(m.venda)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-700">{formatBrl(m.meta)}</td>
                        <td className="py-2 tabular-nums text-slate-700">{formatBrl(m.incremento)}</td>
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
