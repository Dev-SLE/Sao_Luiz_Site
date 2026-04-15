'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { GlobalSearchGroup } from '@/lib/global-search-types';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (query: string) => {
    const t = query.trim();
    if (t.length < 2) {
      setGroups([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/global-search?q=${encodeURIComponent(t)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQ('');
      setGroups([]);
      return;
    }
    const id = window.setTimeout(() => void runSearch(q), 200);
    return () => window.clearTimeout(id);
  }, [q, open, runSearch]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-900/50 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
      <Command
        className="sle-global-cmd w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        label="Busca global"
        shouldFilter={false}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Command.Input
            autoFocus
            placeholder="Buscar CTE, lead, usuário…"
            value={q}
            onValueChange={setQ}
            className="flex-1 border-0 bg-transparent py-3 text-sm outline-none ring-0 placeholder:text-slate-400"
          />
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-slate-800"
            onClick={() => onOpenChange(false)}
          >
            Esc
          </button>
        </div>
        <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2 text-sm">
          {loading && <div className="px-2 py-3 text-xs text-slate-500">Buscando…</div>}
          {!loading && q.trim().length >= 2 && groups.every((g) => !g.items.length) && (
            <div className="px-2 py-3 text-xs text-slate-500">Nenhum resultado.</div>
          )}
          {groups.map((g) =>
            g.items.length ? (
              <Command.Group key={g.type} heading={g.label} className="mb-2">
                {g.items.map((it) => (
                  <Command.Item
                    key={it.id}
                    value={it.id}
                    onSelect={() => {
                      onOpenChange(false);
                      if (it.href) router.push(it.href);
                    }}
                    className="cursor-pointer rounded-lg px-2 py-2 aria-selected:bg-slate-100"
                  >
                    <div className="font-medium text-slate-900">{it.title}</div>
                    {it.subtitle && <div className="text-[11px] text-slate-500">{it.subtitle}</div>}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null,
          )}
        </Command.List>
      </Command>
      </div>
    </div>
  );
}
