'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

export function Comercial360InterpretPanel({
  oQueResponde,
  comoInterpretar,
  oQueFazer,
}: {
  oQueResponde: string;
  comoInterpretar: string;
  oQueFazer: string;
}) {
  return (
    <details className="group surface-card rounded-2xl border border-slate-200/90 bg-white shadow-sm open:border-slate-300">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Guia rápido</span>
          <span className="mt-0.5 block text-sm font-semibold text-slate-900">Como interpretar esta tela</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-2 text-sm text-slate-700">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">O que esta tela responde</dt>
            <dd className="mt-1 leading-snug">{oQueResponde}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Como interpretar</dt>
            <dd className="mt-1 leading-snug">{comoInterpretar}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">O que fazer com isso</dt>
            <dd className="mt-1 leading-snug">{oQueFazer}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
