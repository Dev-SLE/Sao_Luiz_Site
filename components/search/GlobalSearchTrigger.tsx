'use client';

import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { GlobalSearchDialog } from './GlobalSearchDialog';

type Props = {
  variant?: 'portal' | 'workspace';
};

export function GlobalSearchTrigger({ variant = 'workspace' }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ring =
    variant === 'portal'
      ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
      : 'border-sl-navy/20 bg-white/80 text-slate-700 hover:text-sl-navy';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
          ring,
        )}
        title="Busca global (Ctrl+K)"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded bg-black/10 px-1.5 py-0.5 font-mono text-[10px] md:inline">⌘K</kbd>
      </button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
