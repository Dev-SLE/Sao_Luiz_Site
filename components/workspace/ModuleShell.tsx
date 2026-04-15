import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';

export type BreadcrumbItem = { label: string; href?: string };

type Props = {
  moduleTitle: string;
  moduleAccent?: string;
  breadcrumbs: BreadcrumbItem[];
  children: React.ReactNode;
  /** Slot acima do conteúdo (ex.: abas) */
  toolbar?: React.ReactNode;
  className?: string;
};

export function ModuleShell({ moduleTitle, moduleAccent, breadcrumbs, children, toolbar, className }: Props) {
  return (
    <div className={clsx('flex min-h-0 flex-col gap-4', className)}>
      <header className="shrink-0 space-y-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sl-navy/90">{moduleTitle}</p>
          {moduleAccent ? (
            <span className="rounded-full border border-sl-red/25 bg-sl-red/5 px-2.5 py-0.5 text-[10px] font-semibold text-sl-red">
              {moduleAccent}
            </span>
          ) : null}
        </div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-slate-300">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="font-medium text-sl-navy hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-slate-900">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        {toolbar ? <div className="pt-1">{toolbar}</div> : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
