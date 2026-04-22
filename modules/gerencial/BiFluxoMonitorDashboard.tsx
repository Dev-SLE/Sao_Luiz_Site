'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertCircle, HelpCircle, Loader2, Network, TrendingUp, X } from 'lucide-react';
import { CollapsibleMultiSelectWithFilter } from '@/modules/bi/components/CollapsibleMultiSelectWithFilter';
import { BI_FLUXO_CONFIG } from '@/modules/bi/fluxo/config';
import { biGetJson, biGetJsonSafe } from '@/modules/gerencial/biApiClientCache';

const F = BI_FLUXO_CONFIG.filters;

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

function formatMesLabel(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  try {
    return format(parseISO(s), 'MMM/yy', { locale: ptBR });
  } catch {
    return s;
  }
}

function buildQuery(
  from: string,
  to: string,
  agencias: string[],
  tipos: string[],
  perfis: string[],
): string {
  const u = new URLSearchParams();
  u.set('from', from);
  u.set('to', to);
  agencias.forEach((a) => u.append(F.agencia, a));
  tipos.forEach((t) => u.append(F.tipoFluxo, t));
  perfis.forEach((p) => u.append(F.perfil, p));
  return u.toString();
}

const DONUT_COLORS = ['#1e3a5f', '#0d9488', '#c2410c', '#7c3aed', '#ca8a04', '#64748b', '#0369a1'];

/** Textos de ajuda: linguagem simples, sem jargão de views ou schema. */
const HELP = {
  introPainel:
    'Visão geral de como as agências trocam cargas: emissões, recebimentos e equilíbrio. Use os ícones de ajuda nos blocos para ir direto ao conceito.',
  redeLogistica:
    'A rede logística é o comportamento das agências na troca de cargas na operação. Mostra quem emite mais, quem recebe mais e quem está mais equilibrado no fluxo.',
  perfilRede:
    'O perfil da rede classifica a agência pelo comportamento operacional — por exemplo hub, alto valor agregado, consolidador ou padrão. Ajuda a entender o papel da agência na malha.',
  scoreHub:
    'O Score Hub mede a relevância da agência dentro da rede logística. Quanto maior o valor, mais central ela é na circulação de cargas entre origem e destino.',
  saldoFluxo:
    'O saldo de fluxo é a diferença entre recebimentos e emissões da agência. Saldo positivo: recebe mais do que emite. Saldo negativo: emite mais do que recebe.',
  statusRede:
    'O status da rede resume o perfil operacional da agência com base na relação entre emissões e recebimentos.',
  razaoFluxo:
    'A razão de fluxo compara a quantidade de emissões com a de recebimentos. Ajuda a ver se a agência é mais emissora, mais receptora ou equilibrada.',
  indicadores:
    'Resumo do período e dos filtros aplicados. Use estes números para comparar volume, equilíbrio da rede e relevância das agências na malha.',
  balanco:
    'Cada linha contrapõe emissões (à esquerda) e recebimentos (à direita) da mesma agência. Quanto mais afastado do centro, maior a diferença entre os dois lados.',
  evolucao:
    'Acompanhe o ritmo mês a mês: o volume total aparece em destaque; as linhas de emissões e recebimentos ajudam a comparar o comportamento da rede ao longo do tempo.',
  emissoes:
    'Quantidade de operações em que a agência aparece como emissora no período filtrado.',
  cargas:
    'Total de cargas transportadas somando todas as agências e meses do período (e filtros) selecionados.',
  ticketMedio:
    'Valor médio por carga no período: útil para comparar o tamanho médio do negócio entre recortes da rede.',
  pctEquilibrada:
    'Participação de registros classificados como rede equilibrada. Indica quanto da amostra está em equilíbrio entre emissão e recebimento.',
  pctReceptora:
    'Participação de registros classificados como rede receptora. Indica quanto da amostra recebe mais do que emite.',
} as const;

function HelpIcon({
  label,
  text,
  variant = 'default',
}: {
  label: string;
  text: string;
  variant?: 'default' | 'dark' | 'header';
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 12;
    const tw = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 2 * margin : 320);
    const cx = r.left + r.width / 2;
    const half = tw / 2;
    const left =
      typeof window !== "undefined"
        ? Math.max(margin + half, Math.min(window.innerWidth - margin - half, cx))
        : cx;
    setPos({ top: r.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    const onResize = () => updatePos();
    window.addEventListener('resize', onResize);
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open, updatePos]);

  const btnClass =
    variant === 'dark'
      ? 'text-white/55 hover:bg-white/10 hover:text-white focus:ring-white/30'
      : variant === 'header'
        ? 'text-white/65 hover:bg-white/10 hover:text-white focus:ring-amber-300/40'
        : 'text-slate-400 hover:bg-slate-100 hover:text-sl-navy focus:ring-sl-navy/25';

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0 align-middle">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => {
            const next = !o;
            if (next) queueMicrotask(() => updatePos());
            return next;
          });
        }}
        aria-expanded={open}
        aria-label={`Ajuda: ${label}`}
        className={`inline-flex size-5 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 ${btnClass}`}
      >
        <HelpCircle className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          role="tooltip"
          className="fixed z-[200] w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-2xl ring-1 ring-black/5"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">{text}</p>
        </div>
      ) : null}
    </span>
  );
}

function MultiFacet({
  label,
  options,
  selected,
  onToggle,
  onClear,
  helpLabel,
  helpText,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  helpLabel?: string;
  helpText?: string;
}) {
  return (
    <CollapsibleMultiSelectWithFilter
      label={label}
      labelAddon={helpLabel && helpText ? <HelpIcon label={helpLabel} text={helpText} /> : undefined}
      options={options}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      allSummaryLabel="Todas"
      clearButtonLabel="Limpar"
      emptyMessage="Sem opções no período"
      labelMutedClassName="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
      detailsClassName="group relative z-50 min-w-[min(100%,180px)] flex-1 rounded-xl border border-slate-200/90 bg-white shadow-sm open:z-[60] open:shadow-md"
      panelClassName="absolute left-0 right-0 top-full z-[70] mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-slate-900 shadow-xl"
      optionRowClassName="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-900 hover:bg-slate-50"
      optionLabelClassName="min-w-0 flex-1 truncate"
    />
  );
}

export function BiFluxoMonitorDashboard() {
  const now = new Date();
  const defaultTo = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
  const defaultFrom = format(new Date(now.getFullYear(), now.getMonth() - 5, 1), 'yyyy-MM-dd');

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [agencias, setAgencias] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [perfis, setPerfis] = useState<string[]>([]);

  const [facetA, setFacetA] = useState<string[]>([]);
  const [facetT, setFacetT] = useState<string[]>([]);
  const [facetP, setFacetP] = useState<string[]>([]);

  const [kpi, setKpi] = useState<KpiRow | null>(null);
  const [balance, setBalance] = useState<Array<{ agencia: string; qtd_emissoes: number; qtd_recebimentos: number; volume_total: number }>>([]);
  const [statusRows, setStatusRows] = useState<Array<{ status_fluxo: string; qtd_agencias: number; volume_total: number }>>([]);
  const [clusterRows, setClusterRows] = useState<
    Array<{ cluster_perfil: string; qtd_agencias: number; volume_total: number; score_hub_medio: number }>
  >([]);
  const [evolucao, setEvolucao] = useState<
    Array<{
      mes_referencia: string;
      volume_total: number;
      qtd_emissoes: number;
      qtd_recebimentos: number;
      ticket_medio_global: number;
      score_hub_medio: number;
    }>
  >([]);
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableMeta, setTableMeta] = useState<{ limit: number; offset: number; total: number } | null>(null);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [drillAgencia, setDrillAgencia] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const qBase = useMemo(() => buildQuery(from, to, agencias, tipos, perfis), [from, to, agencias, tipos, perfis]);

  const facetFetchRef = useRef<AbortController | null>(null);

  const loadFacets = useCallback(async () => {
    facetFetchRef.current?.abort();
    const ac = new AbortController();
    facetFetchRef.current = ac;
    const qs = buildQuery(from, to, [], [], []);
    try {
      const d = await biGetJson<{
        agencias?: unknown[];
        tiposFluxo?: unknown[];
        perfis?: unknown[];
      }>(`/api/bi/fluxo/facet-options?${qs}`, { signal: ac.signal });
      setFacetA(Array.isArray(d.agencias) ? (d.agencias as string[]) : []);
      setFacetT(Array.isArray(d.tiposFluxo) ? (d.tiposFluxo as string[]) : []);
      setFacetP(Array.isArray(d.perfis) ? (d.perfis as string[]) : []);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (e instanceof Error && e.name === 'AbortError') return;
    }
  }, [from, to]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = `${qBase}&limit=60&offset=${offset}`;
      const [kRes, bRes, sRes, cRes, eRes, tRes] = await Promise.all([
        biGetJsonSafe<{ row?: KpiRow }>(`/api/bi/fluxo/kpis?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/fluxo/agencia-balance?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/fluxo/status-resumo?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/fluxo/cluster-resumo?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/fluxo/evolucao?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[]; meta?: unknown }>(`/api/bi/fluxo/table?${qs}`),
      ]);
      if (!kRes.ok) throw new Error(kRes.error);
      setKpi((kRes.data.row as KpiRow) ?? null);
      if (bRes.ok)
        setBalance(
          (bRes.data.rows ?? []) as Array<{
            agencia: string;
            qtd_emissoes: number;
            qtd_recebimentos: number;
            volume_total: number;
          }>,
        );
      else setBalance([]);
      if (sRes.ok)
        setStatusRows(
          (sRes.data.rows ?? []) as Array<{ status_fluxo: string; qtd_agencias: number; volume_total: number }>,
        );
      else setStatusRows([]);
      if (cRes.ok)
        setClusterRows(
          (cRes.data.rows ?? []) as Array<{
            cluster_perfil: string;
            qtd_agencias: number;
            volume_total: number;
            score_hub_medio: number;
          }>,
        );
      else setClusterRows([]);
      if (eRes.ok)
        setEvolucao(
          (eRes.data.rows ?? []) as Array<{
            mes_referencia: string;
            volume_total: number;
            qtd_emissoes: number;
            qtd_recebimentos: number;
            ticket_medio_global: number;
            score_hub_medio: number;
          }>,
        );
      else setEvolucao([]);
      if (tRes.ok) {
        const tb = tRes.data;
        setTableRows(Array.isArray(tb.rows) ? (tb.rows as Record<string, unknown>[]) : []);
        setTableMeta((tb.meta as { limit: number; offset: number; total: number } | null) ?? null);
      } else {
        setTableRows([]);
        setTableMeta(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar o painel');
    } finally {
      setLoading(false);
    }
  }, [qBase, offset]);

  useEffect(() => {
    void loadFacets();
    return () => {
      facetFetchRef.current?.abort();
    };
  }, [loadFacets]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openDrill = async (agencia: string) => {
    setDrillAgencia(agencia);
    setDrillRows([]);
    setDrillLoading(true);
    try {
      const j = await biGetJson<{ rows?: unknown[] }>(
        `/api/bi/fluxo/drill?${qBase}&agencia=${encodeURIComponent(agencia)}`,
      );
      setDrillRows(Array.isArray(j.rows) ? (j.rows as Record<string, unknown>[]) : []);
    } catch {
      setDrillRows([]);
    } finally {
      setDrillLoading(false);
    }
  };

  const balanceChart = useMemo(
    () =>
      balance.map((r) => ({
        agencia: r.agencia.length > 22 ? `${r.agencia.slice(0, 22)}…` : r.agencia,
        full: r.agencia,
        emNeg: -r.qtd_emissoes,
        rec: r.qtd_recebimentos,
        volume: r.volume_total,
      })),
    [balance],
  );

  const donutData = useMemo(
    () =>
      statusRows.map((r, i) => ({
        name: r.status_fluxo || '—',
        value: r.volume_total,
        qtd: r.qtd_agencias,
        fill: DONUT_COLORS[i % DONUT_COLORS.length],
      })),
    [statusRows],
  );

  const clusterChart = useMemo(
    () =>
      clusterRows.map((r) => ({
        nome: r.cluster_perfil.length > 16 ? `${r.cluster_perfil.slice(0, 16)}…` : r.cluster_perfil,
        full: r.cluster_perfil,
        volume: r.volume_total,
        score: Number(r.score_hub_medio.toFixed(2)),
      })),
    [clusterRows],
  );

  const evoChart = useMemo(
    () =>
      evolucao.map((r) => ({
        mes: formatMesLabel(r.mes_referencia),
        volume: r.volume_total,
        emissoes: r.qtd_emissoes,
        recebimentos: r.qtd_recebimentos,
      })),
    [evolucao],
  );

  const symDomain = useMemo((): [number, number] => {
    let m = 0;
    for (const r of balanceChart) {
      m = Math.max(m, Math.abs(r.emNeg), r.rec);
    }
    if (m === 0) return [-1, 1];
    return [-m, m];
  }, [balanceChart]);

  if (loading && !kpi) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="animate-spin text-sl-navy" size={32} />
        <span className="text-sm font-medium">Carregando monitor de fluxo…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 pb-12 animate-in fade-in duration-300">
      <header className="overflow-visible rounded-3xl border border-sl-navy/15 bg-gradient-to-br from-[#0c1f35] via-[#1e3a5f] to-[#0f2844] p-8 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Network className="size-7 text-amber-300" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90">Operação · Logística</p>
              <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-black tracking-tight md:text-4xl">
                Monitor de fluxo
                <HelpIcon label="Sobre este painel" text={HELP.introPainel} variant="header" />
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
                Leitura executiva da rede: emissões, recebimentos e equilíbrio por agência. Dados consolidados no período — sem recálculo no navegador.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">Indicadores</p>
            <p className="mt-1 text-sm font-semibold text-white/95">Atualização automática ao mudar filtros</p>
          </div>
        </div>
        <div className="mt-8 overflow-visible rounded-2xl bg-white/95 p-4 shadow-inner ring-1 ring-black/5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Filtros</p>
          <div className="flex flex-wrap items-end gap-3 overflow-visible">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Início</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setOffset(0);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setOffset(0);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </div>
            <MultiFacet
              label="Agência"
              helpLabel="Unidade"
              helpText="Filtre por uma ou mais bases. Útil para comparar agências específicas ou focar na sua unidade."
              options={facetA}
              selected={agencias}
              onToggle={(v) => {
                setOffset(0);
                setAgencias((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
              }}
              onClear={() => {
                setOffset(0);
                setAgencias([]);
              }}
            />
            <MultiFacet
              label="Tipo da rede"
              helpLabel="Rede logística"
              helpText={HELP.redeLogistica}
              options={facetT}
              selected={tipos}
              onToggle={(v) => {
                setOffset(0);
                setTipos((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
              }}
              onClear={() => {
                setOffset(0);
                setTipos([]);
              }}
            />
            <MultiFacet
              label="Perfil"
              helpLabel="Perfil da rede"
              helpText={HELP.perfilRede}
              options={facetP}
              selected={perfis}
              onToggle={(v) => {
                setOffset(0);
                setPerfis((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
              }}
              onClear={() => {
                setOffset(0);
                setPerfis([]);
              }}
            />
          </div>
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

      <details className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm open:bg-white open:shadow-md">
        <summary className="cursor-pointer list-none text-sm font-bold text-sl-navy [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <HelpCircle className="size-4 shrink-0 text-sl-navy/70" aria-hidden />
            Como interpretar esta tela
          </span>
        </summary>
        <ul className="mt-3 list-inside list-disc space-y-1.5 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
          <li>Use o período e os filtros para recortar a rede que deseja analisar.</li>
          <li>Os números do topo resumem volume, equilíbrio e relevância no período selecionado.</li>
          <li>Os gráficos mostram quem puxa mais carga para um lado ou outro do fluxo e como isso evolui no tempo.</li>
          <li>Na tabela, clique no nome da agência para ver o detalhe mês a mês.</li>
          <li>Toque no ícone ao lado de cada título para uma explicação curta do conceito.</li>
        </ul>
      </details>

      <section>
        <h2 className="mb-4 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
          <Activity className="size-4 text-sl-navy" aria-hidden />
          <span>Indicadores principais</span>
          <HelpIcon label="Indicadores principais" text={HELP.indicadores} />
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {(
            [
              { label: 'Qtd emissões', v: kpi?.qtd_emissoes, fmt: 'int' as const, help: HELP.emissoes },
              { label: 'Cargas transportadas', v: kpi?.cargas_transportadas, fmt: 'int' as const, help: HELP.cargas },
              { label: 'Ticket médio global', v: kpi?.ticket_medio_global, fmt: 'brl' as const, help: HELP.ticketMedio },
              { label: 'Score hub médio', v: kpi?.score_hub_medio, fmt: 'dec' as const, help: HELP.scoreHub },
              { label: '% Rede equilibrada', v: kpi?.percentual_rede_equilibrada, fmt: 'pct' as const, help: HELP.pctEquilibrada },
              { label: '% Rede receptora', v: kpi?.percentual_rede_receptora, fmt: 'pct' as const, help: HELP.pctReceptora },
            ] as const
          ).map((c) => (
            <div
              key={c.label}
              className="relative overflow-visible rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-5 shadow-md ring-1 ring-slate-100"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sl-navy/[0.06]" />
              </div>
              <div className="relative">
                <div className="flex items-start justify-between gap-1">
                  <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <HelpIcon label={c.label} text={c.help} />
                </div>
                <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">
                  {c.fmt === 'int' && toNum(c.v).toLocaleString('pt-BR')}
                  {c.fmt === 'brl' && formatBrl(toNum(c.v))}
                  {c.fmt === 'dec' && toNum(c.v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  {c.fmt === 'pct' && formatPct01(toNum(c.v))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-lg">
          <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-black text-slate-900">
            Balanço por agência
            <HelpIcon label="Balanço por agência" text={HELP.balanco} />
          </h3>
          <p className="mt-1 text-xs text-slate-500">Emissões (à esquerda) e recebimentos (à direita) — agências com maior volume no período.</p>
          <div className="mt-4 h-[420px]">
            {balanceChart.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-400">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={balanceChart} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 8 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                  <XAxis type="number" domain={symDomain} tickFormatter={(v) => Math.abs(v).toLocaleString('pt-BR')} fontSize={11} />
                  <YAxis type="category" dataKey="agencia" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      Math.abs(Number(val)).toLocaleString('pt-BR'),
                      name === 'Emissões' ? 'Emissões' : 'Recebimentos',
                    ]}
                    labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="emNeg" name="Emissões" fill="#b91c1c" radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="rec" name="Recebimentos" fill="#0d9488" radius={[4, 0, 0, 4]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-lg">
          <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-black text-slate-900">
            Tipo da rede logística
            <HelpIcon label="Rede logística" text={HELP.redeLogistica} />
          </h3>
          <p className="mt-1 text-xs text-slate-500">Volume transportado e quantidade de agências por classificação.</p>
          <div className="mt-4 h-[380px]">
            {donutData.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-400">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={72} outerRadius={118} paddingAngle={2}>
                    {donutData.map((e, i) => (
                      <Cell key={i} fill={e.fill} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, _name, item) => {
                      const q = (item?.payload as { qtd?: number })?.qtd;
                      return [`${Number(v).toLocaleString('pt-BR')} cargas`, q != null ? `${q} agências` : ''];
                    }}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-lg xl:col-span-2">
          <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-black text-slate-900">
            Perfis da rede
            <HelpIcon label="Perfil da rede" text={HELP.perfilRede} />
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span>Volume consolidado e score hub médio por perfil.</span>
            <HelpIcon label="Score Hub" text={HELP.scoreHub} />
          </p>
          <div className="mt-4 h-[320px]">
            {clusterChart.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={clusterChart} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={64} />
                  <YAxis yAxisId="v" tickFormatter={(v) => `${v}`} fontSize={11} />
                  <YAxis yAxisId="s" orientation="right" tickFormatter={(v) => `${v}`} fontSize={11} />
                  <Tooltip
                    formatter={(val: number, name: string) =>
                      name === 'volume' ? [val.toLocaleString('pt-BR'), 'Volume'] : [val.toFixed(2), 'Score hub médio']
                    }
                    labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Legend />
                  <Bar yAxisId="v" dataKey="volume" name="Volume" fill="#1e3a5f" radius={[8, 8, 0, 0]} />
                  <Line yAxisId="s" type="monotone" dataKey="score" name="Score hub" stroke="#ca8a04" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-lg">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
          <TrendingUp className="size-5 shrink-0 text-emerald-600" aria-hidden />
          <span>Evolução histórica do fluxo</span>
          <HelpIcon label="Evolução do fluxo" text={HELP.evolucao} />
        </h3>
        <p className="mt-1 text-xs text-slate-500">Volume total em destaque; emissões e recebimentos para leitura complementar.</p>
        <div className="mt-4 h-[360px]">
          {evoChart.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">Sem dados no período</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evoChart} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="fluxVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="v" tickFormatter={(v) => `${v}`} fontSize={11} />
                <YAxis yAxisId="e" orientation="right" tickFormatter={(v) => `${v}`} fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Legend />
                <Area yAxisId="v" type="monotone" dataKey="volume" name="Volume total" stroke="#1e3a5f" fill="url(#fluxVol)" strokeWidth={2} />
                <Line yAxisId="e" type="monotone" dataKey="emissoes" name="Emissões" stroke="#b91c1c" strokeWidth={2} dot={false} />
                <Line yAxisId="e" type="monotone" dataKey="recebimentos" name="Recebimentos" stroke="#0d9488" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="overflow-visible rounded-3xl border border-slate-200/90 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <h3 className="flex flex-wrap items-center gap-1.5 text-xl font-black text-slate-900">
            Rede por agência
            <HelpIcon label="Rede logística" text={HELP.redeLogistica} />
          </h3>
          <p className="mt-1 text-xs text-slate-500">Métricas agregadas no período — clique na agência para o detalhe mensal.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - 60))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={(tableRows.length || 0) < 60}
            onClick={() => setOffset((o) => o + 60)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white/90">
              <tr>
                <th className="px-4 py-3 align-middle">Agência</th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Emissões
                    <HelpIcon label="Emissões" text={HELP.emissoes} variant="dark" />
                  </span>
                </th>
                <th className="px-4 py-3 align-middle">Recebimentos</th>
                <th className="px-4 py-3 align-middle">Volume total</th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Ticket médio
                    <HelpIcon label="Ticket médio" text={HELP.ticketMedio} variant="dark" />
                  </span>
                </th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Razão de fluxo
                    <HelpIcon label="Razão de fluxo" text={HELP.razaoFluxo} variant="dark" />
                  </span>
                </th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Status da rede
                    <HelpIcon label="Status da rede" text={HELP.statusRede} variant="dark" />
                  </span>
                </th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Perfil
                    <HelpIcon label="Perfil da rede" text={HELP.perfilRede} variant="dark" />
                  </span>
                </th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Score hub
                    <HelpIcon label="Score Hub" text={HELP.scoreHub} variant="dark" />
                  </span>
                </th>
                <th className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    Saldo de fluxo
                    <HelpIcon label="Saldo de fluxo" text={HELP.saldoFluxo} variant="dark" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row, idx) => {
                const ag = String(row.agencia ?? '');
                return (
                  <tr key={`${ag}-${idx}`} className="hover:bg-slate-50/90">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-bold text-sl-navy underline-offset-2 hover:underline"
                        onClick={() => void openDrill(ag)}
                      >
                        {ag}
                      </button>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800">{toNum(row.qtd_emissoes).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-800">{toNum(row.qtd_recebimentos).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-slate-900">{toNum(row.volume_total).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{formatBrl2(toNum(row.ticket_medio))}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{toNum(row.razao_fluxo).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                        {String(row.status_fluxo ?? '—')}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-slate-600" title={String(row.cluster_perfil ?? '')}>
                      {String(row.cluster_perfil ?? '—')}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800">{toNum(row.score_hub).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-slate-900">{toNum(row.saldo_fluxo_qtd).toLocaleString('pt-BR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableMeta ? (
          <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
            {tableMeta.total.toLocaleString('pt-BR')} agência(s) · página {Math.floor(offset / 60) + 1}
          </p>
        ) : null}
      </section>

      {drillAgencia ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-4 sm:items-center" role="dialog" aria-modal>
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Detalhe mensal</p>
                <h4 className="text-lg font-black">{drillAgencia}</h4>
              </div>
              <button type="button" className="rounded-lg p-2 text-white/90 hover:bg-white/10" onClick={() => setDrillAgencia(null)} aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {drillLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-sl-navy" size={28} />
                </div>
              ) : drillRows.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum registro no período para esta agência.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="bg-slate-50 font-bold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Mês</th>
                        <th className="px-3 py-2">Emissões</th>
                        <th className="px-3 py-2">Receb.</th>
                        <th className="px-3 py-2">Volume</th>
                        <th className="px-3 py-2">Emitido R$</th>
                        <th className="px-3 py-2">Recebido R$</th>
                        <th className="px-3 py-2">
                          <span className="inline-flex items-center gap-0.5">
                            Saldo qtd
                            <HelpIcon label="Saldo de fluxo" text={HELP.saldoFluxo} />
                          </span>
                        </th>
                        <th className="px-3 py-2">Saldo R$</th>
                        <th className="px-3 py-2">Ticket</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Perfil</th>
                        <th className="px-3 py-2">
                          <span className="inline-flex items-center gap-0.5">
                            Score
                            <HelpIcon label="Score Hub" text={HELP.scoreHub} />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drillRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 font-mono text-slate-800">{String(r.mes_referencia ?? '').slice(0, 10)}</td>
                          <td className="px-3 py-2 tabular-nums">{toNum(r.qtd_emissoes).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 tabular-nums">{toNum(r.qtd_recebimentos).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 tabular-nums font-semibold">{toNum(r.volume_total).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl2(toNum(r.valor_total_emitido))}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl2(toNum(r.valor_total_recebido))}</td>
                          <td className="px-3 py-2 tabular-nums">{toNum(r.saldo_fluxo_qtd).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl2(toNum(r.saldo_fluxo_valor))}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl2(toNum(r.ticket_medio))}</td>
                          <td className="px-3 py-2">{String(r.status_fluxo ?? '—')}</td>
                          <td className="max-w-[120px] truncate px-3 py-2" title={String(r.cluster_perfil ?? '')}>
                            {String(r.cluster_perfil ?? '—')}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{toNum(r.score_hub).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
