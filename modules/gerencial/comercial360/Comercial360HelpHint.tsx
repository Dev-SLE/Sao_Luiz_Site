'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

export type Comercial360HelpHintVariant = 'onLight' | 'onDark';

type Block = { label: string; text: string };

function PopoverBody({ blocks, body }: { blocks?: Block[]; body?: string }) {
  if (blocks?.length) {
    return (
      <div className="space-y-2.5">
        {blocks.slice(0, 3).map((b) => (
          <div key={b.label}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{b.label}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-slate-800">{b.text}</p>
          </div>
        ))}
      </div>
    );
  }
  if (body) {
    return <p className="text-[13px] leading-snug text-slate-800">{body}</p>;
  }
  return null;
}

/**
 * Ajuda contextual: hover em desktop (ponteiro fino), toque abre/fecha em mobile.
 */
export function Comercial360HelpHint({
  label,
  body,
  blocks,
  variant = 'onLight',
  className = '',
}: {
  /** Rótulo curto para acessibilidade */
  label: string;
  body?: string;
  blocks?: Block[];
  variant?: Comercial360HelpHintVariant;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const m = window.matchMedia('(hover: hover) and (pointer: fine)');
    const fn = () => setFinePointer(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);

  const show = open || (finePointer && hover);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const clearLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };

  const onEnter = useCallback(() => {
    clearLeave();
    setHover(true);
  }, []);

  const onLeave = useCallback(() => {
    clearLeave();
    leaveTimer.current = setTimeout(() => setHover(false), 120);
  }, []);

  const btnDark =
    variant === 'onDark'
      ? 'border-white/40 bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/50'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-sl-navy/30';

  return (
    <span ref={wrapRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none shadow-sm focus:outline-none focus-visible:ring-2 ${btnDark}`}
        aria-label={`Ajuda: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="size-3" strokeWidth={2.5} aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute left-1/2 top-full z-[80] mt-2 w-[min(20rem,calc(100vw-2rem))] max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-left shadow-lg ring-1 ring-black/5 transition duration-150 ${
          show ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
        }`}
      >
        <PopoverBody blocks={blocks} body={body} />
      </span>
    </span>
  );
}

/** Cabeçalho de tabela: rótulo + ajuda alinhados */
export function Comercial360ThHelp({
  children,
  helpLabel,
  body,
  blocks,
}: {
  children: React.ReactNode;
  helpLabel: string;
  body?: string;
  blocks?: Block[];
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      <Comercial360HelpHint label={helpLabel} body={body} blocks={blocks} />
    </span>
  );
}
