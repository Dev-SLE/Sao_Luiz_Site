'use client';

import React, { type ReactNode, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type BiMultiSelectOption = string | { value: string; label: string };

function normalizeOptions(options: readonly BiMultiSelectOption[]) {
  return options.map((o) =>
    typeof o === 'string'
      ? { key: o, label: o, search: o.toLowerCase() }
      : { key: o.value, label: o.label, search: `${o.label} ${o.value}`.toLowerCase() },
  );
}

export type CollapsibleMultiSelectWithFilterProps = {
  label: string;
  /** Ícone de ajuda etc., ao lado do rótulo em caixa alta */
  labelAddon?: ReactNode;
  options: readonly BiMultiSelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  /** Texto do resumo quando nada está selecionado */
  allSummaryLabel?: string;
  /** Sufixo do contador, ex. "selecionado(s)" ou "selec." */
  selectedSuffix?: string;
  clearButtonLabel?: string;
  emptyMessage?: string;
  detailsClassName: string;
  summaryClassName?: string;
  labelMutedClassName?: string;
  summaryValueClassName?: string;
  chevronClassName?: string;
  panelClassName?: string;
  searchInputClassName?: string;
  hintClassName?: string;
  optionRowClassName?: string;
  optionLabelClassName?: string;
  checkboxClassName?: string;
  clearButtonClassName?: string;
};

export function CollapsibleMultiSelectWithFilter({
  label,
  labelAddon,
  options,
  selected,
  onToggle,
  onClear,
  allSummaryLabel = 'Todos',
  selectedSuffix = 'selecionado(s)',
  clearButtonLabel = 'Limpar seleção',
  emptyMessage = 'Sem opções',
  detailsClassName,
  summaryClassName = 'flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden',
  labelMutedClassName = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500',
  summaryValueClassName = 'text-sm font-semibold text-slate-900',
  chevronClassName = 'size-4 shrink-0 text-slate-500 transition group-open:rotate-180',
  panelClassName = 'absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl',
  searchInputClassName = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sl-navy/40 focus:ring-1 focus:ring-sl-navy/20',
  hintClassName = 'px-3 pb-1 text-[10px] leading-snug text-slate-500',
  optionRowClassName = 'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50',
  optionLabelClassName = 'truncate',
  checkboxClassName = 'rounded border-slate-300 text-sl-navy focus:ring-sl-navy/30',
  clearButtonClassName = 'text-xs font-semibold text-sl-navy underline',
}: CollapsibleMultiSelectWithFilterProps) {
  const [filterQ, setFilterQ] = useState('');
  const norm = useMemo(() => normalizeOptions(options), [options]);
  const filtered = useMemo(() => {
    const s = filterQ.trim().toLowerCase();
    if (!s) return norm;
    return norm.filter((o) => o.search.includes(s));
  }, [norm, filterQ]);

  const summary = selected.length ? `${selected.length} ${selectedSuffix}` : allSummaryLabel;

  return (
    <details
      className={detailsClassName}
      onToggle={(e) => {
        const el = e.currentTarget;
        if (!el.open) setFilterQ('');
      }}
    >
      <summary className={summaryClassName}>
        <span>
          <span className={labelMutedClassName}>
            {label}
            {labelAddon}
          </span>
          <span className={summaryValueClassName}>{summary}</span>
        </span>
        <ChevronDown className={chevronClassName} aria-hidden />
      </summary>
      <div className={panelClassName}>
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-3 pb-2 pt-1">
          <p className={hintClassName}>Pesquisar: digite abaixo para filtrar esta lista (os itens já marcados permanecem selecionados).</p>
          <input
            type="search"
            value={filterQ}
            onChange={(ev) => setFilterQ(ev.target.value)}
            onClick={(ev) => ev.stopPropagation()}
            onKeyDown={(ev) => ev.stopPropagation()}
            placeholder="Filtrar opções…"
            className={searchInputClassName}
            aria-label={`Filtrar opções de ${label}`}
          />
        </div>
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">Nenhuma opção corresponde à pesquisa.</p>
        ) : (
          filtered.map((opt) => (
            <label key={opt.key} className={optionRowClassName}>
              <input
                type="checkbox"
                checked={selected.includes(opt.key)}
                onChange={() => onToggle(opt.key)}
                className={checkboxClassName}
              />
              <span className={optionLabelClassName} title={opt.label}>
                {opt.label}
              </span>
            </label>
          ))
        )}
        <div className="border-t border-slate-100 px-3 pt-2">
          <button
            type="button"
            className={clearButtonClassName}
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            {clearButtonLabel}
          </button>
        </div>
      </div>
    </details>
  );
}
