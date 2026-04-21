'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, Loader2, X } from 'lucide-react';
import {
  buildComercial360QueryString,
  defaultComercial360Period,
  mergeFiltersFromSearchParams,
  type Comercial360FacetOptions,
  type Comercial360FilterState,
} from '@/modules/gerencial/comercial360/comercial360Client';
import { formatBrlDetail, toNum } from '@/modules/gerencial/comercial360/comercial360Format';
import { GLOSSARY } from '@/modules/gerencial/comercial360/comercial360HelpContent';
import { Comercial360HelpHint, Comercial360ThHelp } from '@/modules/gerencial/comercial360/Comercial360HelpHint';
import { Comercial360InterpretPanel } from '@/modules/gerencial/comercial360/Comercial360InterpretPanel';

export type Comercial360ShellVariant = 'cockpit' | 'executiva' | 'risco' | 'gap' | 'radar';

type Ctx = {
  queryString: string;
  filters: Comercial360FilterState;
  patchFilters: (partial: Partial<Comercial360FilterState>) => void;
  openDrill: (matchKey: string) => void;
};

const Comercial360Context = createContext<Ctx | null>(null);

export function useComercial360(): Ctx {
  const c = useContext(Comercial360Context);
  if (!c) throw new Error('useComercial360: use dentro de Comercial360Shell');
  return c;
}

const VARIANT_HEADER: Record<
  Comercial360ShellVariant,
  { gradient: string; eyebrow: string }
> = {
  cockpit: {
    gradient: 'from-amber-700 via-orange-800 to-amber-950',
    eyebrow: 'Cockpit comercial',
  },
  executiva: {
    gradient: 'from-slate-800 via-[#1e3a5f] to-slate-950',
    eyebrow: 'Central executiva',
  },
  risco: {
    gradient: 'from-rose-800 via-red-900 to-rose-950',
    eyebrow: 'Risco e ciclo de vida',
  },
  gap: {
    gradient: 'from-violet-800 via-indigo-900 to-violet-950',
    eyebrow: 'Potencial e GAP',
  },
  radar: {
    gradient: 'from-teal-700 via-cyan-800 to-teal-950',
    eyebrow: 'Radar de prospecção',
  },
};

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
  const summary = selected.length ? `${selected.length} selec.` : 'Todas';
  return (
    <details className="group relative min-w-[200px] flex-1 rounded-xl border border-white/25 bg-white/10 shadow-sm backdrop-blur open:z-40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-left text-white [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-white/70">{label}</span>
          <span className="text-sm font-semibold">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-white/80 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-slate-900 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Sem valores no período</p>
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
          <button type="button" className="text-xs font-semibold text-sl-navy underline" onClick={onClear}>
            Limpar
          </button>
        </div>
      </div>
    </details>
  );
}

type DrillRow = Record<string, unknown>;

function Comercial360DrillDrawer({
  open,
  queryString,
  matchKey,
  onClose,
}: {
  open: boolean;
  queryString: string;
  matchKey: string | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<DrillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !matchKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const u = `/api/bi/comercial-360/drill?${queryString}&match_key=${encodeURIComponent(matchKey)}`;
        const res = await fetch(u, { credentials: 'include', cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (!res.ok) {
          setErr(String(data?.error || 'Falha ao carregar drill'));
          setRows([]);
          return;
        }
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        if (!cancelled) {
          setErr('Falha de rede ao carregar drill');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, matchKey, queryString]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative z-[101] flex max-h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 pr-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Detalhe do cliente</span>
              <Comercial360HelpHint
                variant="onLight"
                label="Detalhe do cliente"
                body="Linhas do período selecionado: evolução do status, valores e papéis logísticos. Use para preparar conversa comercial."
              />
            </p>
            <p className="truncate text-sm font-bold text-slate-900">{matchKey}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-slate-600">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Carregando linhas do período…</span>
            </div>
          ) : err ? (
            <p className="text-sm text-rose-700">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-600">Sem linhas para este cliente no período.</p>
          ) : (
            <div>
              <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Comercial360HelpHint
                  label="Papéis na operação"
                  blocks={[
                    { label: 'Tomador', text: GLOSSARY.atuacaoTomador },
                    { label: 'Remetente', text: GLOSSARY.atuacaoRemetente },
                    { label: 'Destinatário', text: GLOSSARY.atuacaoDestinatario },
                  ]}
                />
                <span className="max-w-md leading-snug">
                  {GLOSSARY.comportamentoLogistico} As colunas Tom., Rem. e Dest. resumem o SIM/NÃO no período.
                </span>
              </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-2 py-2">Referência</th>
                    <th className="min-w-[140px] px-2 py-2">Razão social</th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Status da atividade" body={GLOSSARY.statusAtividade}>
                        Status
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Faturamento real" body={GLOSSARY.faturamentoReal}>
                        Faturamento
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Potencial estimado" body={GLOSSARY.potencialEstimado}>
                        Potencial
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="GAP" body={GLOSSARY.gapNaMesa}>
                        GAP
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Dinheiro em risco" body={GLOSSARY.dinheiroEmRisco}>
                        Risco
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Ticket médio" body={GLOSSARY.ticketMedio}>
                        Ticket
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Recência" body={GLOSSARY.recencia}>
                        Dias
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Tomador" body={GLOSSARY.atuacaoTomador}>
                        Tom.
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Remetente" body={GLOSSARY.atuacaoRemetente}>
                        Rem.
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Destinatário" body={GLOSSARY.atuacaoDestinatario}>
                        Dest.
                      </Comercial360ThHelp>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-2 py-2 text-slate-800">
                        {String(r.data_referencia ?? '').slice(0, 10)}
                      </td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-slate-800" title={String(r.razao_social ?? '')}>
                        {String(r.razao_social ?? '')}
                      </td>
                      <td className="max-w-[120px] truncate px-2 py-2 text-slate-700">{String(r.status_atividade ?? '')}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                        {formatBrlDetail(toNum(r.faturamento_real))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                        {formatBrlDetail(toNum(r.potencial_estimado))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                        {formatBrlDetail(toNum(r.gap_estimado))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                        {formatBrlDetail(toNum(r.dinheiro_em_risco))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                        {formatBrlDetail(toNum(r.ticket_medio_pagante))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">
                        {String(r.recencia_dias ?? '')}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-600">{String(r.filtro_atuou_tomador ?? '')}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-600">{String(r.filtro_atuou_remetente ?? '')}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-600">{String(r.filtro_atuou_destinatario ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Comercial360Shell({
  variant,
  title,
  titleHelp,
  description,
  interpret,
  children,
}: {
  variant: Comercial360ShellVariant;
  title: string;
  /** Texto curto ao lado do título (diretoria / gestão). */
  titleHelp?: string;
  description?: string;
  interpret?: { oQueResponde: string; comoInterpretar: string; oQueFazer: string };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const def = useMemo(() => defaultComercial360Period(), []);
  const [filters, setFilters] = useState<Comercial360FilterState>(() => ({
    from: def.from,
    to: def.to,
    mensalista: [],
    temContrato: [],
    cidade: [],
    statusAtividade: [],
    categoria: [],
    tipoDocumento: [],
    atuouTomador: [],
    atuouRemetente: [],
    atuouDestinatario: [],
  }));
  const [facets, setFacets] = useState<Comercial360FacetOptions | null>(null);
  const [facetErr, setFacetErr] = useState<string | null>(null);
  const [drillKey, setDrillKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFilters((prev) => mergeFiltersFromSearchParams(new URLSearchParams(searchParams.toString()), prev));
  }, [searchParams]);

  const queryString = useMemo(() => buildComercial360QueryString(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    const qsPeriod = new URLSearchParams();
    qsPeriod.set("from", filters.from);
    qsPeriod.set("to", filters.to);
    (async () => {
      try {
        const res = await fetch(`/api/bi/comercial-360/facet-options?${qsPeriod.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (!res.ok) {
          setFacetErr(String(data?.error || 'Falha ao carregar opções de filtro'));
          setFacets(null);
          return;
        }
        setFacetErr(null);
        setFacets(data as Comercial360FacetOptions);
      } catch {
        if (!cancelled) {
          setFacetErr('Falha de rede nos filtros');
          setFacets(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.from, filters.to]);

  const pushUrl = useCallback(() => {
    const qs = buildComercial360QueryString(filters);
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }, [filters, pathname, router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushUrl(), 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pushUrl]);

  const openDrill = useCallback((matchKey: string) => {
    const k = String(matchKey || '').trim();
    if (k) setDrillKey(k);
  }, []);

  const patchFilters = useCallback((partial: Partial<Comercial360FilterState>) => {
    setFilters((p) => ({ ...p, ...partial }));
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({ queryString, filters, patchFilters, openDrill }),
    [filters, openDrill, patchFilters, queryString],
  );

  const v = VARIANT_HEADER[variant];

  const setFromTo = (from: string, to: string) => {
    setFilters((p) => ({ ...p, from, to }));
  };

  return (
    <Comercial360Context.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <header
          className={`overflow-visible rounded-2xl bg-gradient-to-br px-5 py-5 text-white shadow-md ${v.gradient}`}
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">{v.eyebrow}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
                {titleHelp ? (
                  <Comercial360HelpHint variant="onDark" label={title} body={titleHelp} className="shrink-0" />
                ) : null}
              </div>
              {description ? <p className="mt-1 max-w-2xl text-sm text-white/85">{description}</p> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 md:mt-0">
              <label className="flex flex-col text-[10px] font-bold uppercase text-white/70">
                De
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFromTo(e.target.value, filters.to)}
                  className="mt-1 rounded-lg border border-white/30 bg-white/15 px-2 py-1.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </label>
              <label className="flex flex-col text-[10px] font-bold uppercase text-white/70">
                Até
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFromTo(filters.from, e.target.value)}
                  className="mt-1 rounded-lg border border-white/30 bg-white/15 px-2 py-1.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </label>
            </div>
          </div>
          {facetErr ? <p className="mt-3 text-sm text-amber-100">{facetErr}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 overflow-visible">
            <MultiFacet
              label="Mensalista"
              options={facets?.mensalistas ?? []}
              selected={filters.mensalista}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  mensalista: p.mensalista.includes(v) ? p.mensalista.filter((x) => x !== v) : [...p.mensalista, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, mensalista: [] }))}
            />
            <MultiFacet
              label="Contrato"
              options={facets?.temContrato ?? []}
              selected={filters.temContrato}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  temContrato: p.temContrato.includes(v) ? p.temContrato.filter((x) => x !== v) : [...p.temContrato, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, temContrato: [] }))}
            />
            <MultiFacet
              label="Cidade / UF"
              options={facets?.cidades ?? []}
              selected={filters.cidade}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  cidade: p.cidade.includes(v) ? p.cidade.filter((x) => x !== v) : [...p.cidade, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, cidade: [] }))}
            />
            <MultiFacet
              label="Status"
              options={facets?.statusAtividades ?? []}
              selected={filters.statusAtividade}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  statusAtividade: p.statusAtividade.includes(v)
                    ? p.statusAtividade.filter((x) => x !== v)
                    : [...p.statusAtividade, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, statusAtividade: [] }))}
            />
            <MultiFacet
              label="Categoria"
              options={facets?.categorias ?? []}
              selected={filters.categoria}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  categoria: p.categoria.includes(v) ? p.categoria.filter((x) => x !== v) : [...p.categoria, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, categoria: [] }))}
            />
            <MultiFacet
              label="Documento"
              options={facets?.tiposDocumento ?? []}
              selected={filters.tipoDocumento}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  tipoDocumento: p.tipoDocumento.includes(v)
                    ? p.tipoDocumento.filter((x) => x !== v)
                    : [...p.tipoDocumento, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, tipoDocumento: [] }))}
            />
            <MultiFacet
              label="Tomador"
              options={facets?.tomadores ?? []}
              selected={filters.atuouTomador}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  atuouTomador: p.atuouTomador.includes(v) ? p.atuouTomador.filter((x) => x !== v) : [...p.atuouTomador, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, atuouTomador: [] }))}
            />
            <MultiFacet
              label="Remetente"
              options={facets?.remetentes ?? []}
              selected={filters.atuouRemetente}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  atuouRemetente: p.atuouRemetente.includes(v)
                    ? p.atuouRemetente.filter((x) => x !== v)
                    : [...p.atuouRemetente, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, atuouRemetente: [] }))}
            />
            <MultiFacet
              label="Destinatário"
              options={facets?.destinatarios ?? []}
              selected={filters.atuouDestinatario}
              onToggle={(v) =>
                setFilters((p) => ({
                  ...p,
                  atuouDestinatario: p.atuouDestinatario.includes(v)
                    ? p.atuouDestinatario.filter((x) => x !== v)
                    : [...p.atuouDestinatario, v],
                }))
              }
              onClear={() => setFilters((p) => ({ ...p, atuouDestinatario: [] }))}
            />
          </div>
          <p className="mt-3 text-[11px] text-white/70">
            Período:{' '}
            <span className="font-semibold text-white">
              {(() => {
                try {
                  return (
                    <>
                      {format(parseISO(filters.from), "d 'de' MMM yyyy", { locale: ptBR })} —{' '}
                      {format(parseISO(filters.to), "d 'de' MMM yyyy", { locale: ptBR })}
                    </>
                  );
                } catch {
                  return `${filters.from} — ${filters.to}`;
                }
              })()}
            </span>
          </p>
        </header>
        {interpret ? (
          <Comercial360InterpretPanel
            oQueResponde={interpret.oQueResponde}
            comoInterpretar={interpret.comoInterpretar}
            oQueFazer={interpret.oQueFazer}
          />
        ) : null}
        {children}
      </div>
      <Comercial360DrillDrawer
        open={!!drillKey}
        matchKey={drillKey}
        queryString={queryString}
        onClose={() => setDrillKey(null)}
      />
    </Comercial360Context.Provider>
  );
}
