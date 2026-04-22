'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
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
import {
  AlertCircle,
  ChevronDown,
  Coins,
  HelpCircle,
  Loader2,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { BI_TAXAS_CONFIG } from '@/modules/bi/taxas/config';
import { biGetJson, biGetJsonSafe } from '@/modules/gerencial/biApiClientCache';

const F = BI_TAXAS_CONFIG.filters;

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

/** Razão 0–1 vinda do SQL → percentagem legível. */
function formatRatioPct(n: number, digits = 1): string {
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
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
  perfis: string[],
  servicos: string[],
): string {
  const u = new URLSearchParams();
  u.set('from', from);
  u.set('to', to);
  agencias.forEach((a) => u.append(F.agencia, a));
  perfis.forEach((p) => u.append(F.perfilCobranca, p));
  servicos.forEach((s) => u.append(F.servicoExtra, s));
  return u.toString();
}

const DONUT_COLORS = ['#0f766e', '#1e3a5f', '#a16207', '#7c3aed', '#c2410c', '#64748b'];

const HELP = {
  intro:
    'Visão comercial da cobrança de serviços extras: quanto entra, como pesa no faturamento e onde há espaço para crescer. Os números vêm consolidados do período — sem recálculo no navegador.',
  receitaExtras: 'Soma da receita de taxas e serviços extras no período selecionado.',
  impacto: 'Participação da receita de extras em relação ao faturamento total analisado no mesmo recorte.',
  faturamento: 'Faturamento total das operações consideradas na base do período.',
  ticketMedio: 'Receita de extras dividida pelo volume de emissões e recebimentos somados — indica o tamanho médio do “extra” por movimento.',
  penColeta: 'Participação dos movimentos de emissão em que houve cobrança de taxa de coleta.',
  penEntrega: 'Participação dos movimentos de recebimento em que houve cobrança de taxa de entrega.',
  composicao: 'Como a receita extra se reparte entre coleta, entrega, pedágio, SECCAT e demais rubricas.',
  tmServico: 'Ticket médio por tipo de serviço extra — útil para comparar política de preço entre rubricas.',
  evolucao: 'Evolução mês a mês da penetração global e da representatividade dos extras sobre o faturamento.',
  ranking:
    'Agências com faturamento relevante e penetração ainda baixa tendem a ter mais espaço para capturar receita de extras. O score combina volume e folga de penetração.',
  tabela:
    'Resumo por agência no período: receita de extras, penetração, ticket médio de coleta e entrega, status de cobrança e perfil. Clique na agência para o detalhe mensal.',
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
    const tw = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 2 * margin : 320);
    const cx = r.left + r.width / 2;
    const half = tw / 2;
    const left =
      typeof window !== 'undefined'
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
  const summary = selected.length ? `${selected.length} selecionado(s)` : 'Todas';
  return (
    <details className="group relative z-50 min-w-[180px] flex-1 rounded-xl border border-slate-200/90 bg-white shadow-sm open:z-[60] open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {label}
            {helpLabel && helpText ? <HelpIcon label={helpLabel} text={helpText} /> : null}
          </span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-slate-900 shadow-xl">
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

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('muito baixo') || s.includes('🔻')) {
    return 'border-amber-300/80 bg-amber-50 text-amber-950';
  }
  if (s.includes('bem') || s.includes('💎')) {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-950';
  }
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function heatAlpha(v: number, lo: number, hi: number): string {
  if (!Number.isFinite(v) || hi <= lo) return 'rgb(10 22 40 / 0.04)';
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  const a = 0.06 + t * 0.42;
  return `rgb(10 22 40 / ${a})`;
}

export function BiTaxasGerencialDashboard() {
  const now = new Date();
  const defaultTo = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
  const defaultFrom = format(new Date(now.getFullYear(), now.getMonth() - 5, 1), 'yyyy-MM-dd');

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [agencias, setAgencias] = useState<string[]>([]);
  const [perfis, setPerfis] = useState<string[]>([]);
  const [servicos, setServicos] = useState<string[]>([]);

  const [facetA, setFacetA] = useState<string[]>([]);
  const [facetP, setFacetP] = useState<string[]>([]);
  const [facetS, setFacetS] = useState<string[]>([]);

  const [kpi, setKpi] = useState<KpiRow | null>(null);
  const [composicao, setComposicao] = useState<Array<{ servico: string; receita: number }>>([]);
  const [tmRows, setTmRows] = useState<Array<{ servico: string; ticket_medio: number }>>([]);
  const [evolucao, setEvolucao] = useState<
    Array<{
      mes_referencia: string;
      receita_extras_total: number;
      pct_representatividade_extras: number;
      pct_penetracao_entrega_global: number;
      pct_penetracao_coleta_global: number;
    }>
  >([]);
  const [ranking, setRanking] = useState<
    Array<{
      agencia: string;
      faturamento_total: number;
      receita_extras: number;
      pct_penetracao_entrega: number;
      pct_penetracao_coleta: number;
      score_oportunidade: number;
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

  const qBase = useMemo(
    () => buildQuery(from, to, agencias, perfis, servicos),
    [from, to, agencias, perfis, servicos],
  );

  const facetFetchRef = useRef<AbortController | null>(null);

  const loadFacets = useCallback(async () => {
    facetFetchRef.current?.abort();
    const ac = new AbortController();
    facetFetchRef.current = ac;
    const qs = buildQuery(from, to, [], [], []);
    try {
      const d = await biGetJson<{
        agencias?: unknown[];
        perfis?: unknown[];
        servicos?: unknown[];
      }>(`/api/bi/taxas/facet-options?${qs}`, { signal: ac.signal });
      setFacetA(Array.isArray(d.agencias) ? (d.agencias as string[]) : []);
      setFacetP(Array.isArray(d.perfis) ? (d.perfis as string[]) : []);
      setFacetS(Array.isArray(d.servicos) ? (d.servicos as string[]) : []);
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
      const [kRes, cRes, tRes, eRes, rRes, tbRes] = await Promise.all([
        biGetJsonSafe<{ row?: KpiRow }>(`/api/bi/taxas/kpis?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/taxas/composicao?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/taxas/tm-servico?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/taxas/evolucao?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/taxas/ranking?${qBase}`),
        biGetJsonSafe<{ rows?: unknown[]; meta?: unknown }>(`/api/bi/taxas/table?${qs}`),
      ]);
      if (!kRes.ok) throw new Error(kRes.error);
      setKpi((kRes.data.row as KpiRow) ?? null);
      if (cRes.ok) setComposicao((cRes.data.rows ?? []) as Array<{ servico: string; receita: number }>);
      else setComposicao([]);
      if (tRes.ok) setTmRows((tRes.data.rows ?? []) as Array<{ servico: string; ticket_medio: number }>);
      else setTmRows([]);
      if (eRes.ok)
        setEvolucao(
          (eRes.data.rows ?? []) as Array<{
            mes_referencia: string;
            receita_extras_total: number;
            pct_representatividade_extras: number;
            pct_penetracao_entrega_global: number;
            pct_penetracao_coleta_global: number;
          }>,
        );
      else setEvolucao([]);
      if (rRes.ok)
        setRanking(
          (rRes.data.rows ?? []) as Array<{
            agencia: string;
            faturamento_total: number;
            receita_extras: number;
            pct_penetracao_entrega: number;
            pct_penetracao_coleta: number;
            score_oportunidade: number;
          }>,
        );
      else setRanking([]);
      if (tbRes.ok) {
        const tb = tbRes.data;
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

  const donutData = useMemo(
    () =>
      composicao
        .filter((r) => r.receita > 0)
        .map((r, i) => ({
          name: r.servico,
          value: r.receita,
          fill: DONUT_COLORS[i % DONUT_COLORS.length],
        })),
    [composicao],
  );

  const tmChart = useMemo(
    () =>
      tmRows.map((r) => ({
        nome: r.servico.replace(/^TM\s+/i, ''),
        tm: r.ticket_medio,
        full: r.servico,
      })),
    [tmRows],
  );

  const evoChart = useMemo(
    () =>
      evolucao.map((r) => ({
        mes: formatMesLabel(r.mes_referencia),
        penEntrega: r.pct_penetracao_entrega_global * 100,
        penColeta: r.pct_penetracao_coleta_global * 100,
        repExtras: r.pct_representatividade_extras * 100,
      })),
    [evolucao],
  );

  const rankChart = useMemo(
    () =>
      ranking.slice(0, 10).map((r) => ({
        nome: r.agencia.length > 20 ? `${r.agencia.slice(0, 20)}…` : r.agencia,
        full: r.agencia,
        score: Number(r.score_oportunidade.toFixed(4)),
        fat: r.faturamento_total,
      })),
    [ranking],
  );

  const heatRanges = useMemo(() => {
    const rec = tableRows.map((x) => toNum(x.receita_servicos_extras));
    const rep = tableRows.map((x) => toNum(x.pct_representatividade_extras));
    const pe = tableRows.map((x) => toNum(x.pct_penetracao_entrega));
    const pc = tableRows.map((x) => toNum(x.pct_penetracao_coleta));
    const minmax = (arr: number[]) => ({
      lo: arr.length ? Math.min(...arr) : 0,
      hi: arr.length ? Math.max(...arr) : 0,
    });
    return {
      rec: minmax(rec),
      rep: minmax(rep),
      pe: minmax(pe),
      pc: minmax(pc),
    };
  }, [tableRows]);

  const openDrill = async (agencia: string) => {
    setDrillAgencia(agencia);
    setDrillRows([]);
    setDrillLoading(true);
    try {
      const j = await biGetJson<{ rows?: unknown[] }>(
        `/api/bi/taxas/drill?${qBase}&agencia=${encodeURIComponent(agencia)}`,
      );
      setDrillRows(Array.isArray(j.rows) ? (j.rows as Record<string, unknown>[]) : []);
    } catch {
      setDrillRows([]);
    } finally {
      setDrillLoading(false);
    }
  };

  if (loading && !kpi) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="animate-spin text-sl-navy" size={32} />
        <span className="text-sm font-medium">Carregando gestão de taxas…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-8 pb-14">
      <header className="overflow-visible rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#0a1628] via-[#132a4a] to-[#0c2038] p-8 text-white shadow-2xl ring-1 ring-amber-300/15">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-white/10 ring-1 ring-white/20">
              <Coins className="size-7 text-amber-300" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90">Operação · Receita</p>
              <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-black tracking-tight md:text-4xl">
                Gestão de taxas
                <HelpIcon label="Sobre este painel" text={HELP.intro} variant="header" />
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/88">
                Monetização de serviços extras, penetração e ticket médio — leitura gerencial para priorizar ações
                comerciais na base.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">Atualização</p>
            <p className="mt-1 text-sm font-semibold text-white/95">Automática ao mudar filtros</p>
          </div>
        </div>
        <div className="mt-8 overflow-visible rounded-2xl bg-white/[0.97] p-4 shadow-inner ring-1 ring-black/5">
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
              helpText="Recorte por uma ou mais bases. Combine com período e perfil para focar oportunidades."
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
              label="Perfil de cobrança"
              helpLabel="Perfil"
              helpText="Classificação de perfil de cobrança na base analítica."
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
            <MultiFacet
              label="Tipo de extra"
              helpLabel="Serviço"
              helpText="Filtra linhas em que há receita (ou ausência) na rubrica indicada, conforme a base do período."
              options={facetS}
              selected={servicos}
              onToggle={(v) => {
                setOffset(0);
                setServicos((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
              }}
              onClear={() => {
                setOffset(0);
                setServicos([]);
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

      <section>
        <h2 className="mb-4 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
          <Sparkles className="size-4 text-amber-600" aria-hidden />
          <span>Indicadores principais</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {(
            [
              { label: 'Receita de serviços extras', key: 'receita_servicos_extras', fmt: 'brl' as const, help: HELP.receitaExtras },
              { label: '% impacto no faturamento', key: 'impacto_faturamento_percentual', fmt: 'pct' as const, help: HELP.impacto },
              { label: 'Faturamento total analisado', key: 'faturamento_total_analisado', fmt: 'brl' as const, help: HELP.faturamento },
              { label: 'Ticket médio extras', key: 'ticket_medio_extras', fmt: 'brl2' as const, help: HELP.ticketMedio },
              { label: '% penetração coleta', key: 'penetracao_coleta_global', fmt: 'pct' as const, help: HELP.penColeta },
              { label: '% penetração entrega', key: 'penetracao_entrega_global', fmt: 'pct' as const, help: HELP.penEntrega },
            ] as const
          ).map((c) => (
            <div
              key={c.key}
              className="relative overflow-visible rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-lg ring-1 ring-slate-100/80"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/[0.07]" />
              </div>
              <div className="relative">
                <div className="flex items-start justify-between gap-1">
                  <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <HelpIcon label={c.label} text={c.help} />
                </div>
                <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">
                  {c.fmt === 'brl' && formatBrl(toNum(kpi?.[c.key]))}
                  {c.fmt === 'brl2' && formatBrl2(toNum(kpi?.[c.key]))}
                  {c.fmt === 'pct' && formatRatioPct(toNum(kpi?.[c.key]))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-visible rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
            Composição da receita extra
            <HelpIcon label="Composição" text={HELP.composicao} />
          </h3>
          <p className="mt-1 text-xs text-slate-500">Coleta, entrega, pedágio, SECCAT e demais rubricas.</p>
          <div className="mt-4 h-[320px]">
            {donutData.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-400">Sem receita de extras no período</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={donutData[i].fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBrl(v)} contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="overflow-visible rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
            Ticket médio por serviço
            <HelpIcon label="TM por serviço" text={HELP.tmServico} />
          </h3>
          <p className="mt-1 text-xs text-slate-500">Comparativo horizontal entre rubricas.</p>
          <div className="mt-4 h-[320px]">
            {tmChart.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-400">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tmChart} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatBrl2(v)} fontSize={11} />
                  <YAxis type="category" dataKey="nome" width={88} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => formatBrl2(v)}
                    labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Bar dataKey="tm" name="Ticket médio" radius={[0, 6, 6, 0]} fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-visible rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
          Evolução mensal
          <HelpIcon label="Evolução" text={HELP.evolucao} />
        </h3>
        <p className="mt-1 text-xs text-slate-500">Penetração global e representatividade dos extras (%).</p>
        <div className="mt-4 h-[360px]">
          {evoChart.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">Sem dados no período</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evoChart} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} fontSize={11} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="penEntrega" name="% pen. entrega" stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="penColeta" name="% pen. coleta" stroke="#b45309" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="repExtras" name="% repr. extras" stroke="#1e3a5f" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="overflow-visible rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
          Ranking de oportunidade
          <HelpIcon label="Oportunidade" text={HELP.ranking} />
        </h3>
        <p className="mt-1 text-xs text-slate-500">Volume alto com penetração ainda folgada — prioridade comercial sugerida.</p>
        <div className="mt-4 h-[380px]">
          {rankChart.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">Sem dados para ranquear</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankChart} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                <XAxis type="number" dataKey="score" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => v.toFixed(4)}
                  labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="score" name="Score oportunidade" radius={[0, 4, 4, 0]} fill="#1e3a5f" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="overflow-visible rounded-3xl border border-slate-200/90 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <h3 className="flex flex-wrap items-center gap-2 text-xl font-black text-slate-900">
            <TrendingUp className="size-5 text-emerald-600" aria-hidden />
            Resumo por agência
            <HelpIcon label="Tabela" text={HELP.tabela} />
          </h3>
          <p className="mt-1 text-xs text-slate-500">Receita, penetração, ticket médio e status de cobrança no período.</p>
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
          <table className="w-full min-w-[1280px] text-left text-xs">
            <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white/90">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-900 px-3 py-3">Agência</th>
                <th className="px-3 py-3">Receita extras</th>
                <th className="px-3 py-3">% repr. extras</th>
                <th className="px-3 py-3">TM entrega</th>
                <th className="px-3 py-3">Status entrega</th>
                <th className="px-3 py-3">% pen. entrega</th>
                <th className="px-3 py-3">TM coleta</th>
                <th className="px-3 py-3">Status coleta</th>
                <th className="px-3 py-3">% pen. coleta</th>
                <th className="px-3 py-3">Perfil</th>
                <th className="px-3 py-3">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row, idx) => {
                const ag = String(row.agencia ?? '');
                const rec = toNum(row.receita_servicos_extras);
                const rep = toNum(row.pct_representatividade_extras);
                const pe = toNum(row.pct_penetracao_entrega);
                const pc = toNum(row.pct_penetracao_coleta);
                return (
                  <tr key={`${ag}-${idx}`} className="hover:bg-slate-50/90">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-bold text-sl-navy shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => void openDrill(ag)}
                      >
                        {ag}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold" style={{ backgroundColor: heatAlpha(rec, heatRanges.rec.lo, heatRanges.rec.hi) }}>
                      {formatBrl(rec)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ backgroundColor: heatAlpha(rep, heatRanges.rep.lo, heatRanges.rep.hi) }}>
                      {formatRatioPct(rep, 2)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBrl2(toNum(row.tm_entrega))}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex max-w-[140px] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(String(row.status_cobranca_entrega ?? ''))}`}
                        title={String(row.status_cobranca_entrega ?? '')}
                      >
                        {String(row.status_cobranca_entrega ?? '—')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ backgroundColor: heatAlpha(pe, heatRanges.pe.lo, heatRanges.pe.hi) }}>
                      {formatRatioPct(pe, 1)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBrl2(toNum(row.tm_coleta))}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex max-w-[140px] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(String(row.status_cobranca_coleta ?? ''))}`}
                        title={String(row.status_cobranca_coleta ?? '')}
                      >
                        {String(row.status_cobranca_coleta ?? '—')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ backgroundColor: heatAlpha(pc, heatRanges.pc.lo, heatRanges.pc.hi) }}>
                      {formatRatioPct(pc, 1)}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-slate-700" title={String(row.perfil_cobranca ?? '')}>
                      {String(row.perfil_cobranca ?? '—')}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-900">{formatBrl(toNum(row.faturamento_total))}</td>
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
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#0f2844] to-[#1e3a5f] px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Detalhe mensal</p>
                <h4 className="text-lg font-black">{drillAgencia}</h4>
              </div>
              <button type="button" className="rounded-lg p-2 text-white/90 hover:bg-white/10" onClick={() => setDrillAgencia(null)} aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-5">
              {drillLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-sl-navy" size={28} />
                </div>
              ) : drillRows.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum registro no período para esta agência.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[1100px] text-left text-xs">
                    <thead className="bg-slate-50 font-bold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Mês</th>
                        <th className="px-3 py-2">Faturamento</th>
                        <th className="px-3 py-2">Receita extras</th>
                        <th className="px-3 py-2">% repr.</th>
                        <th className="px-3 py-2">TM entrega</th>
                        <th className="px-3 py-2">Status entrega</th>
                        <th className="px-3 py-2">TM coleta</th>
                        <th className="px-3 py-2">Status coleta</th>
                        <th className="px-3 py-2">Perfil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drillRows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{formatMesLabel(String(r.mes_referencia ?? ''))}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl(toNum(r.faturamento_total))}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl(toNum(r.receita_extras_total))}</td>
                          <td className="px-3 py-2 tabular-nums">{formatRatioPct(toNum(r.pct_representatividade_extras), 2)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl2(toNum(r.tm_entrega))}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(String(r.status_cobranca_entrega ?? ''))}`}>
                              {String(r.status_cobranca_entrega ?? '—')}
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{formatBrl2(toNum(r.tm_coleta))}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(String(r.status_cobranca_coleta ?? ''))}`}>
                              {String(r.status_cobranca_coleta ?? '—')}
                            </span>
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-slate-600">{String(r.perfil_cobranca ?? '—')}</td>
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
