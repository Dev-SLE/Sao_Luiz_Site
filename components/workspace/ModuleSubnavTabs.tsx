'use client';

/**
 * Abas horizontais só para contexto **local à mesma vista** (ex.: secções de um registo).
 * Não usar como substituto do menu lateral para rotas de módulo — essas vivem no sidebar.
 */
import Link from 'next/link';
import clsx from 'clsx';

export type ModuleSubnavTab = {
  href: string;
  label: string;
  active: boolean;
};

type Props = {
  tabs: ModuleSubnavTab[];
  className?: string;
  size?: 'default' | 'sm';
  activeTextClass?: string;
  inactiveTextClass?: string;
  underlineClass?: string;
};

export function ModuleSubnavTabs({
  tabs,
  className,
  size = 'default',
  activeTextClass = 'text-sl-navy',
  inactiveTextClass = 'text-slate-600 hover:text-slate-900',
  underlineClass = 'after:bg-sl-red',
}: Props) {
  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label="Navegação do módulo"
      className={clsx('-mx-1 flex flex-wrap gap-x-0.5 border-b border-slate-200/80 pb-px', className)}
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={clsx(
            'relative shrink-0 px-3 py-2 text-xs font-semibold transition-colors duration-200',
            size === 'sm' && 'px-2 py-1.5 text-[11px]',
            t.active ? activeTextClass : inactiveTextClass,
            t.active &&
              clsx(
                'after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-sm',
                underlineClass,
              ),
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
