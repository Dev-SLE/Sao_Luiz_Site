'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import clsx from 'clsx';
import type { UnifiedNotification } from '@/lib/notifications-types';
import { authClient } from '@/lib/auth';
import { FloatingDropdownPortal } from '@/components/workspace/FloatingDropdownPortal';

type Props = {
  variant?: 'portal' | 'workspace';
};

export function NotificationsCenter({ variant = 'workspace' }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UnifiedNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=30', { credentials: 'include' });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount || 0));
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 25000);
    return () => window.clearInterval(id);
  }, [load]);

  const markOperationalRead = async () => {
    const opIds = items
      .filter((n) => n.kind === 'operational' && n.meta && typeof (n.meta as any).sourceLogId === 'number')
      .map((n) => Number((n.meta as any).sourceLogId));
    const maxId = Math.max(0, ...opIds);
    if (maxId > 0) {
      await authClient.ackOperationalNotifications(maxId).catch(() => null);
    }
    setUnread(0);
    setOpen(false);
    await load();
  };

  const btnRing =
    variant === 'portal'
      ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
      : 'border-sl-navy/20 bg-white/80 text-slate-700 hover:text-sl-navy';

  const usePortal = variant === 'workspace';

  const panelInner = (
    <>
      <div
        className={clsx(
          'flex items-center justify-between border-b px-3 py-2',
          variant === 'portal' ? 'border-white/10' : 'border-slate-100',
        )}
      >
        <span className="text-xs font-bold">Central de notificações</span>
        <button
          type="button"
          className={clsx(
            'text-[11px] hover:underline',
            variant === 'portal' ? 'text-sl-red-light' : 'text-sl-navy',
          )}
          onClick={() => void markOperationalRead()}
        >
          Marcar lidas
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className={clsx('px-3 py-3 text-[11px]', variant === 'portal' ? 'text-white/60' : 'text-slate-500')}>
            Carregando…
          </div>
        ) : items.length === 0 ? (
          <div className={clsx('px-3 py-3 text-[11px]', variant === 'portal' ? 'text-white/60' : 'text-slate-500')}>
            Sem notificações.
          </div>
        ) : (
          items.map((n) => {
            const rowClass = clsx(
              'block border-b px-3 py-2 text-left text-[11px] transition-colors',
              variant === 'portal'
                ? 'border-white/10 text-white/90 hover:bg-white/10'
                : 'border-slate-100 text-slate-700 hover:bg-slate-50',
              n.href && 'cursor-pointer',
            );
            const body = (
              <>
                <div className="font-semibold">{n.title}</div>
                {n.subtitle ? <div className="opacity-80">{n.subtitle}</div> : null}
                {n.href ? (
                  <div
                    className={clsx(
                      'mt-1 text-[10px] font-bold',
                      variant === 'portal' ? 'text-sl-red-light' : 'text-sl-navy',
                    )}
                  >
                    Abrir →
                  </div>
                ) : null}
              </>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} className={rowClass} onClick={() => setOpen(false)}>
                {body}
              </Link>
            ) : (
              <div key={n.id} className={rowClass}>
                {body}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className={usePortal ? 'contents' : 'relative z-50'}>
      <button
        ref={bellRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className={clsx(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
          btnRing,
        )}
        title="Notificações"
        aria-expanded={open}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-sl-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {usePortal ? (
        <FloatingDropdownPortal
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={bellRef}
          width={320}
          className={clsx(
            'overflow-hidden rounded-xl border shadow-xl',
            'border-slate-200 bg-white text-slate-800',
          )}
        >
          {panelInner}
        </FloatingDropdownPortal>
      ) : (
        open && (
          <div
            className={clsx(
              'absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl',
              variant === 'portal'
                ? 'border-white/10 bg-sl-navy text-white'
                : 'border-slate-200 bg-white text-slate-800',
            )}
          >
            {panelInner}
          </div>
        )
      )}
    </div>
  );
}
