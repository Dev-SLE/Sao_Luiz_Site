'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Link from 'next/link';
import { AlertCircle, ChevronDown, FileText, Loader2, X } from 'lucide-react';
import { BI_COMISSOES_CONFIG, KPI_SLOTS, type KpiSlotDef } from '@/modules/bi/comissoes/config';
import { gerencialComissoesHoleritePath } from '@/modules/gerencial/routes';
import { biGetJson } from '@/modules/gerencial/biApiClientCache';

type Row = Record<string, unknown>;

const NAVY = '#1e3a5f';
const RED = '#c41e3a';
const TEAL = '#0f766e';
const AMBER = '#b45309';
const SLATE = '#64748b';
const STACK_PALETTE = [NAVY, RED, TEAL, AMBER, '#4f46e5', '#0d9488', '#a21caf', SLATE];

function isBlankVendorName(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (t === '—' || t === '-' || t === 'N/A' || t.toLowerCase() === 'null') return true;
  if (/sem\s*vendedor|indeterminado|não informado|nao informado/i.test(t)) return true;
  if (/bloqueado|vencido/i.test(t)) return true;
  return false;
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n);
}

function formatPct(raw: unknown, keyHint: string): string {
  const n = toNum(raw);
  const k = keyHint.toLowerCase();
  if (/ratio|decimal|frac/i.test(k)) {
    return `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  }
  if (n > 0 && n <= 1 && !Number.isInteger(n)) {
    return `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  }
  if (n > 1 && n <= 100) {
    return `${n.toFixed(2).replace(/\.?0+$/, '')}%`;
  }
  if (n > 100) {
    return `${(n / 100).toFixed(2)}%`;
  }
  return `${n}%`;
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function pickCol(rows: Row[], patterns: RegExp[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  for (const re of patterns) {
    const hit = keys.find((k) => re.test(k));
    if (hit) return hit;
  }
  return null;
}

/** Uma linha por vendedor (`vendedor_final`); colunas empilhadas = `tipo_comissao`. */
function buildVendorTipoChart(rows: Row[]): { data: Row[]; stackKeys: string[]; vendedorKey: string } {
  if (!rows.length) return { data: [], stackKeys: [], vendedorKey: 'name' };
  const cat = BI_COMISSOES_CONFIG.grouping.chartCategory;
  const ser = BI_COMISSOES_CONFIG.grouping.chartSeries;
  const rowKeys = Object.keys(rows[0]);
  const vk =
    rowKeys.find((k) => k.toLowerCase() === cat.toLowerCase()) ||
    pickCol(rows, [/nome.*vendedor|^vendedor$/i, /^nm_vendedor$/i, /cod_vendedor/i]) ||
    rowKeys[0];
  const tk =
    rowKeys.find((k) => k.toLowerCase() === ser.toLowerCase()) ||
    pickCol(rows, [/tipo.*comiss/i, /tipo_venda/i, /tipo_lancamento/i, /^tipo$/i]);
  let valK: string | null = null;
  for (const c of BI_COMISSOES_CONFIG.chartValueCandidates) {
    const hit = rowKeys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (hit) {
      valK = hit;
      break;
    }
  }
  if (!valK) {
    valK =
      pickCol(rows, [/^valor.*comiss/i, /^vl.*comiss/i, /^valor_comissao$/i, /^valor$/i, /vlr_comiss/i]) ||
      pickCol(rows, [/valor/i]);
  }

  if (!tk || !valK) {
    const by = new Map<string, number>();
    for (const r of rows) {
      const name = String(r[vk] ?? '—').trim() || '—';
      by.set(name, (by.get(name) || 0) + toNum(r[valK || vk]));
    }
    return {
      data: [...by]
        .map(([name, Total]) => ({ name, Total }))
        .filter((row) => !isBlankVendorName(String(row.name ?? ''))),
      stackKeys: ['Total'],
      vendedorKey: vk,
    };
  }

  const tipos = new Set<string>();
  const agg = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const name = String(r[vk] ?? '—').trim() || '—';
    const tipo = String(r[tk] ?? 'Demais').trim() || 'Demais';
    if (/bloqueado|vencido/i.test(tipo)) continue;
    tipos.add(tipo);
    if (!agg.has(name)) agg.set(name, {});
    const m = agg.get(name)!;
    m[tipo] = (m[tipo] || 0) + toNum(r[valK]);
  }
  const stackKeys = [...tipos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const data = [...agg]
    .map(([name, ob]) => ({ name, ...ob }))
    .filter((row) => !isBlankVendorName(String(row.name ?? '')));
  data.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  return { data, stackKeys, vendedorKey: vk };
}

function pickKpiValue(row: Row | null, slot: KpiSlotDef): { raw: unknown; key: string | null } {
  if (!row) return { raw: null, key: slot.key };
  const raw = row[slot.key];
  if (raw === null || raw === undefined || raw === '') return { raw: null, key: slot.key };
  return { raw, key: slot.key };
}

function formatKpiValue(slot: KpiSlotDef, raw: unknown, key: string | null): string {
  if (raw === null || raw === undefined) return '—';
  if (slot.format === 'currency') return formatBrl(toNum(raw));
  if (slot.format === 'percent') return formatPct(raw, key || '');
  return formatInt(toNum(raw));
}

const DRILL_LABELS: { match: RegExp; label: string }[] = [
  { match: /tipo.*comiss|tipo_venda|tipo_lanc|^tipo$/i, label: 'Tipo de comissão' },
  { match: /qtd.*regist|qtde.*reg|count.*reg/i, label: 'Qtd. registros' },
  { match: /qtd.*nota|qtde.*nota|notas/i, label: 'Qtd. notas' },
  { match: /valor.*comiss|vl.*comiss/i, label: 'Valor comissão' },
  { match: /valor.*base|base.*calculo|vl_base/i, label: 'Valor base de cálculo' },
  { match: /fatur|valor.*venda|vl_fatur/i, label: 'Valor faturado' },
];

function drillColumnLabel(col: string): string {
  const hit = DRILL_LABELS.find((d) => d.match.test(col));
  return hit?.label ?? col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function CollapsibleMultiSelect({
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
    <details className="group relative min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm open:z-30 open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="text-sm font-semibold text-slate-900">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Sem opções</p>
        ) : (
          options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
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
          <button
            type="button"
            className="text-xs font-semibold text-sl-navy underline"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            Limpar seleção
          </button>
        </div>
      </div>
    </details>
  );
}

function formatDrillCell(col: string, v: unknown): string {
  if (v === null || v === undefined) return '—';
  const cl = col.toLowerCase();
  if (/tipo|nome|desc|classif/i.test(cl) && typeof v === 'string') return v;
  if (/qtd|qtde|count|nota/i.test(cl)) return formatInt(toNum(v));
  if (/valor|vlr|fatur|base|comiss/i.test(cl)) return formatBrl(toNum(v));
  if (/perc|pct|ratio|%/i.test(cl)) return formatPct(v, col);
  if (typeof v === 'number') return formatBrl(toNum(v));
  return String(v);
}

type FacetKeys = { vendedor: string | null; tipo: string | null; tabela: string | null };

export function BiComissoesDashboard() {
  const defaultFrom = useMemo(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'), []);
  const defaultTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [selVendedores, setSelVendedores] = useState<string[]>([]);
  const [selTipos, setSelTipos] = useState<string[]>([]);
  const [selTabelas, setSelTabelas] = useState<string[]>([]);
  const [facetKeys, setFacetKeys] = useState<FacetKeys>({ vendedor: null, tipo: null, tabela: null });
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [tabelas, setTabelas] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  const [ranking, setRanking] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Row[]>([]);
  const [table, setTable] = useState<Row[]>([]);
  const [drill, setDrill] = useState<Row[]>([]);
  const [drillTitle, setDrillTitle] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryBase = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const F = BI_COMISSOES_CONFIG.filters;
    const vk = facetKeys.vendedor || F.vendedor;
    const tk = facetKeys.tipo || F.tipoComissao;
    const tbk = facetKeys.tabela || F.tabelaNome;
    for (const v of selVendedores) {
      if (v) q.append(vk, v);
    }
    for (const v of selTipos) {
      if (v) q.append(tk, v);
    }
    for (const v of selTabelas) {
      if (v) q.append(tbk, v);
    }
    return q.toString();
  }, [from, to, selVendedores, selTipos, selTabelas, facetKeys]);

  const loadFacets = useCallback(async () => {
    try {
      const j = await biGetJson<{
        vendedores?: unknown[];
        tipos?: unknown[];
        tabelas?: unknown[];
        keys?: { vendedor?: string; tipo?: string; tabela?: string };
      }>('/api/bi/comissoes/facet-options');
      setVendedores(Array.isArray(j.vendedores) ? (j.vendedores as string[]) : []);
      setTipos(Array.isArray(j.tipos) ? (j.tipos as string[]) : []);
      setTabelas(Array.isArray(j.tabelas) ? (j.tabelas as string[]) : []);
      const k = j.keys || {};
      setFacetKeys({
        vendedor: typeof k.vendedor === 'string' ? k.vendedor : null,
        tipo: typeof k.tipo === 'string' ? k.tipo : null,
        tabela: typeof k.tabela === 'string' ? k.tabela : null,
      });
    } catch {
      /* igual ao fluxo anterior em resposta não-ok */
    }
  }, []);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rankParams = new URLSearchParams(queryBase);
      rankParams.set('limit', '8000');
      const rankQs = rankParams.toString();
      const kpiUrl = queryBase ? `/api/bi/comissoes/kpis?${queryBase}` : '/api/bi/comissoes/kpis';
      const tableParams = new URLSearchParams(queryBase);
      tableParams.set('limit', '5000');
      const tableQs = tableParams.toString();
      const tableUrl = tableQs ? `/api/bi/comissoes/table?${tableQs}` : '/api/bi/comissoes/table?limit=5000';

      const [rankJson, kpiJson, tableJson] = await Promise.all([
        biGetJson<{ rows?: unknown[] }>(`/api/bi/comissoes/ranking?${rankQs}`),
        biGetJson<{ rows?: unknown[] }>(kpiUrl),
        biGetJson<{ rows?: unknown[] }>(tableUrl),
      ]);

      setRanking(Array.isArray(rankJson.rows) ? (rankJson.rows as Row[]) : []);
      setKpis(Array.isArray(kpiJson.rows) ? (kpiJson.rows as Row[]) : []);
      setTable(Array.isArray(tableJson.rows) ? (tableJson.rows as Row[]) : []);
      setDrill([]);
      setDrillTitle(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [queryBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const rankingFiltered = useMemo(() => {
    const cat = BI_COMISSOES_CONFIG.grouping.chartCategory;
    const vk = BI_COMISSOES_CONFIG.filters.vendedor;
    const ser = BI_COMISSOES_CONFIG.grouping.chartSeries;
    return ranking.filter((r) => {
      const name = String(r[cat] ?? r[vk] ?? '').trim();
      if (isBlankVendorName(name)) return false;
      const tk =
        Object.keys(r).find((k) => k.toLowerCase() === ser.toLowerCase()) ||
        pickCol([r], [/tipo.*comiss/i, /^tipo$/i]);
      const tipo = tk ? String(r[tk] ?? '').trim() : '';
      if (tipo && /bloqueado|vencido/i.test(tipo)) return false;
      return true;
    });
  }, [ranking]);

  const kpiRow = useMemo(() => kpis[0] ?? null, [kpis]);

  const { data: chartData, stackKeys } = useMemo(() => buildVendorTipoChart(rankingFiltered), [rankingFiltered]);

  const tableRowsBase = useMemo(() => {
    const vk = BI_COMISSOES_CONFIG.grouping.tableGroup;
    return table.filter((r) => {
      const name = String(r[vk] ?? r[BI_COMISSOES_CONFIG.filters.vendedor] ?? '').trim();
      return !isBlankVendorName(name);
    });
  }, [table]);

  const tableDisplay = useMemo(() => {
    const s = tableSearch.trim().toLowerCase();
    if (!s) return tableRowsBase;
    return tableRowsBase.filter((r) =>
      Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(s)),
    );
  }, [tableRowsBase, tableSearch]);

  const tableColumns = useMemo(() => (table[0] ? Object.keys(table[0]) : []), [table]);

  const tableHeaderLabel = (col: string) => {
    const m = DRILL_LABELS.find((d) => d.match.test(col));
    if (m) return m.label;
    if (/vendedor|nome/i.test(col)) return 'Vendedor';
    if (/agencia|filial/i.test(col)) return 'Agência';
    if (/data/i.test(col)) return 'Data';
    return col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const totals = useMemo(() => {
    if (!tableDisplay.length || !tableColumns.length) return null as Record<string, number> | null;
    const out: Record<string, number> = {};
    for (const c of tableColumns) {
      if (/tipo|nome|vendedor|desc|status|text|cod|sigla|data/i.test(c)) continue;
      let s = 0;
      let any = false;
      for (const r of tableDisplay) {
        const n = toNum(r[c]);
        if (Number.isFinite(n) && r[c] !== null && r[c] !== '') {
          s += n;
          any = true;
        }
      }
      if (any) out[c] = s;
    }
    return out;
  }, [tableDisplay, tableColumns]);

  const loadDrill = async (q: URLSearchParams, title: string) => {
    setDrillTitle(title);
    setDrill([]);
    q.set('limit', '2000');
    try {
      const j = await biGetJson<{ rows?: unknown[]; error?: string }>(`/api/bi/comissoes/drill?${q.toString()}`);
      setError(null);
      setDrill(Array.isArray(j.rows) ? (j.rows as Row[]) : []);
    } catch (e) {
      setDrill([]);
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o detalhamento.');
    }
  };

  const loadDrillForVendorTipo = async (vendorName: string, tipoComissao?: string) => {
    const q = new URLSearchParams(queryBase);
    const F = BI_COMISSOES_CONFIG.filters;
    if (facetKeys.vendedor) q.set(facetKeys.vendedor, vendorName);
    else q.set(F.vendedor, vendorName);
    if (tipoComissao && facetKeys.tipo) q.set(facetKeys.tipo, tipoComissao);
    else if (tipoComissao) q.set(F.tipoComissao, tipoComissao);
    const title =
      tipoComissao && tipoComissao.length > 0 ? `${vendorName} — ${tipoComissao}` : vendorName;
    await loadDrill(q, title);
  };

  const loadDrillForTableRow = async (r: Row) => {
    const q = new URLSearchParams(queryBase);
    const F = BI_COMISSOES_CONFIG.filters;
    const tg = BI_COMISSOES_CONFIG.grouping.tableGroup;
    const vendVal = r[F.vendedor] ?? r[tg];
    if (vendVal != null && String(vendVal) !== '') {
      if (facetKeys.vendedor) q.set(facetKeys.vendedor, String(vendVal));
      else q.set(F.vendedor, String(vendVal));
    }
    const tipoVal = r[F.tipoComissao];
    if (tipoVal != null && String(tipoVal) !== '') {
      if (facetKeys.tipo) q.set(facetKeys.tipo, String(tipoVal));
      else q.set(F.tipoComissao, String(tipoVal));
    }
    const label = String(r[F.vendedor] ?? r[tg] ?? 'Detalhamento');
    await loadDrill(q, label);
  };

  const showTabela = tabelas.length > 0 && facetKeys.tabela;

  function toggleInList(list: string[], setList: (u: string[]) => void, value: string) {
    if (list.includes(value)) setList(list.filter((x) => x !== value));
    else setList([...list, value]);
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-white to-slate-50/90 pb-12 pt-2">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 md:px-6">
        <header className="rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white via-white to-slate-50/90 px-5 py-6 shadow-[0_12px_40px_rgba(30,58,95,0.08)] md:px-8 md:py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sl-red">Gerencial</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">Comissões</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Resumo executivo e desempenho por vendedor no período selecionado.
          </p>
          <div className="mt-4 print:hidden">
            <Link
              href={gerencialComissoesHoleritePath(queryBase)}
              className="inline-flex items-center gap-2 rounded-xl border border-sl-navy/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-sl-navy shadow-sm transition hover:bg-slate-50"
            >
              <FileText size={16} strokeWidth={2} />
              Holerite de comissões
            </Link>
            <span className="ml-3 text-[11px] text-slate-500">Mesmos filtros do período · documento holerite_comissoes</span>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm md:px-5 md:py-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filtros</p>
          <div className="mt-3 flex flex-wrap items-end gap-3 md:gap-4">
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Período — início</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-sl-navy/20 focus:border-sl-navy/40 focus:ring-2"
              />
            </label>
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Período — fim</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-sl-navy/20 focus:border-sl-navy/40 focus:ring-2"
              />
            </label>
            {facetKeys.vendedor ? (
              <CollapsibleMultiSelect
                label="Vendedores"
                options={vendedores}
                selected={selVendedores}
                onToggle={(v) => toggleInList(selVendedores, setSelVendedores, v)}
                onClear={() => setSelVendedores([])}
              />
            ) : null}
            {facetKeys.tipo ? (
              <CollapsibleMultiSelect
                label="Tipos de comissão"
                options={tipos}
                selected={selTipos}
                onToggle={(v) => toggleInList(selTipos, setSelTipos, v)}
                onClear={() => setSelTipos([])}
              />
            ) : null}
            {showTabela ? (
              <CollapsibleMultiSelect
                label="Tabelas"
                options={tabelas}
                selected={selTabelas}
                onToggle={(v) => toggleInList(selTabelas, setSelTabelas, v)}
                onClear={() => setSelTabelas([])}
              />
            ) : null}
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-900 shadow-sm">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading && !ranking.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sl-navy/20 bg-white py-24 text-slate-600 shadow-inner">
            <Loader2 className="animate-spin text-sl-navy" size={32} />
            <span className="text-sm font-medium">Carregando indicadores…</span>
          </div>
        ) : null}

        {!loading && !rankingFiltered.length && !tableRowsBase.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-600 shadow-sm">
            Não há dados para o período e filtros selecionados.
          </div>
        ) : null}

        {kpiRow ? (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Resumo de comissões</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {KPI_SLOTS.map((slot) => {
                const { raw, key } = pickKpiValue(kpiRow, slot);
                return (
                  <div
                    key={slot.key}
                    className="relative overflow-hidden rounded-2xl border border-sl-navy/10 bg-gradient-to-br from-white to-slate-50/90 p-5 shadow-[0_8px_30px_rgba(30,58,95,0.07)]"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-sl-red/10" aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{slot.label}</p>
                    <p className="relative mt-3 text-2xl font-bold tracking-tight text-sl-navy md:text-3xl">
                      {formatKpiValue(slot, raw, key)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {chartData.length > 0 && stackKeys.length > 0 ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_36px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-sl-navy">Desempenho por vendedor</h2>
              <p className="text-xs text-slate-500">Valores empilhados por tipo de comissão. Clique em uma barra para ver o detalhamento.</p>
            </div>
            <div className="h-[440px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: SLATE, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatBrl(Number(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={176}
                    tick={{ fontSize: 11, fill: NAVY, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(30, 58, 95, 0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload as Row;
                      return (
                        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-xs shadow-xl">
                          <p className="font-bold text-sl-navy">{String(p.name)}</p>
                          <ul className="mt-2 space-y-1">
                            {stackKeys.map((k) => (
                              <li key={k} className="flex justify-between gap-6 text-slate-600">
                                <span>{k}</span>
                                <span className="font-semibold text-slate-900">{formatBrl(toNum(p[k]))}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }}
                  />
                  {stackKeys.map((k, i) => (
                    <Bar key={k} dataKey={k} stackId="a" radius={[0, 4, 4, 0]} barSize={22}>
                      {chartData.map((row, idx) => (
                        <Cell
                          key={`c-${k}-${idx}`}
                          fill={STACK_PALETTE[i % STACK_PALETTE.length]}
                          className="cursor-pointer outline-none"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            const name = String(row?.name ?? '');
                            if (name) void loadDrillForVendorTipo(name, k);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              const name = String(row?.name ?? '');
                              if (name) void loadDrillForVendorTipo(name, k);
                            }
                          }}
                        />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3">
              {stackKeys.map((legendKey, i) => (
                <li key={legendKey} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: STACK_PALETTE[i % STACK_PALETTE.length] }}
                    aria-hidden
                  />
                  {legendKey}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tableColumns.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="border-b border-sl-navy/10 bg-gradient-to-r from-sl-navy to-[#2a4a7a] px-5 py-4">
              <h2 className="text-lg font-bold text-white">Detalhamento</h2>
              <p className="text-xs font-medium text-white/80">Clique em uma linha para abrir o detalhe por tipo</p>
            </div>
            <div className="border-b border-slate-100 bg-white px-4 py-3 print:hidden">
              <label className="flex max-w-md flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pesquisar na tabela</span>
                <input
                  type="search"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filtrar por qualquer coluna…"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sl-navy/40 focus:ring-2 focus:ring-sl-navy/15"
                />
              </label>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="bg-slate-100/90 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {tableColumns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-3">
                        {tableHeaderLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableDisplay.map((r, i) => (
                    <tr
                      key={i}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-red-50/40 odd:bg-white even:bg-slate-50/40"
                      onClick={() => void loadDrillForTableRow(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void loadDrillForTableRow(r);
                        }
                      }}
                    >
                      {tableColumns.map((c) => (
                        <td key={c} className="whitespace-nowrap px-4 py-2.5 text-slate-800">
                          {/valor|vlr|fatur|total|comiss|base/i.test(c) ? formatBrl(toNum(r[c])) : String(r[c] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {totals && (
                    <tr className="border-t-2 border-sl-navy/20 bg-sl-navy/[0.06] font-bold text-sl-navy">
                      {tableColumns.map((c) => (
                        <td key={c} className="whitespace-nowrap px-4 py-3">
                          {c === tableColumns[0]
                            ? 'Total'
                            : totals[c] != null
                              ? formatBrl(totals[c])
                              : ''}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      {drillTitle && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => {
            setDrillTitle(null);
            setDrill([]);
          }}
        >
          <aside
            className="flex h-full w-full max-w-md animate-in slide-in-from-right flex-col border-l border-slate-200 bg-white shadow-2xl duration-200"
            role="dialog"
            aria-modal
            aria-labelledby="drill-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-sl-red">Detalhamento por tipo</p>
                <h3 id="drill-title" className="mt-1 text-lg font-bold text-sl-navy">
                  {drillTitle}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                onClick={() => {
                  setDrillTitle(null);
                  setDrill([]);
                }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!drill.length ? (
                <p className="text-sm text-slate-500">Nenhum detalhe para este vendedor no período.</p>
              ) : (
                <div className="space-y-4">
                  {drill.map((r, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
                    >
                      <dl className="grid gap-2 text-sm">
                        {Object.keys(r).map((col) => (
                          <div key={col} className="flex justify-between gap-4 border-b border-slate-100/80 py-1 last:border-0">
                            <dt className="text-slate-500">{drillColumnLabel(col)}</dt>
                            <dd className="text-right font-semibold text-slate-900">{formatDrillCell(col, r[col])}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
