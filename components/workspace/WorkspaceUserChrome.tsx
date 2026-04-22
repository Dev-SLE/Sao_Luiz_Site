'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, CircleDot, LogOut, User as UserIcon, LayoutDashboard } from 'lucide-react';
import clsx from 'clsx';
import { useWorkspaceShell } from '@/context/WorkspaceShellContext';
import { FloatingDropdownPortal } from '@/components/workspace/FloatingDropdownPortal';
import { NotificationsCenter } from '@/components/notifications/NotificationsCenter';
import { useData } from '@/context/DataContext';

type Props = {
  /** Variante visual dos botões (alinhar ao módulo) */
  variant?: 'default' | 'crm' | 'comercial' | 'hub';
};

const profileRing: Record<NonNullable<Props['variant']>, string> = {
  default: 'border-sl-navy/25 hover:border-sl-red/35',
  crm: 'border-sl-navy/25 hover:border-sl-red/35',
  comercial: 'border-sl-navy/25 hover:border-sl-red/35',
  hub: 'border-sl-navy/25 hover:border-sl-red/35',
};

const avatarGrad: Record<NonNullable<Props['variant']>, string> = {
  default: 'from-sl-navy to-sl-navy-light',
  crm: 'from-sl-navy to-sl-navy-light',
  comercial: 'from-sl-navy to-sl-navy-light',
  hub: 'from-sl-navy to-sl-navy-light',
};

export function WorkspaceUserChrome({ variant = 'default' }: Props) {
  const { user, logout, profileOpen, setProfileOpen } = useWorkspaceShell();
  const { hasPermission } = useData();
  const profileBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      <NotificationsCenter variant="workspace" />
      <button
        ref={profileBtnRef}
        type="button"
        onClick={() => setProfileOpen((v) => !v)}
        className={clsx(
          'group interactive-lift flex items-center gap-2 rounded-full border bg-gradient-to-b from-white to-slate-50 px-2 py-1 pl-1 shadow-sm sm:gap-3 sm:px-3',
          profileRing[variant],
        )}
      >
        <div
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-xs font-black text-white',
            avatarGrad[variant],
          )}
        >
          {user.username[0]?.toUpperCase?.() || <CircleDot size={14} />}
        </div>
        <div className="hidden flex-col items-start sm:flex">
          <span className="text-[11px] leading-tight text-slate-500">Olá,</span>
          <span className="max-w-[120px] truncate text-xs font-semibold leading-tight text-slate-800 md:max-w-[140px]">
            {user.username}
          </span>
        </div>
        <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
      </button>

      <FloatingDropdownPortal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        anchorRef={profileBtnRef}
        width={240}
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-400/25"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/80 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500">Conectado como</p>
          <p className="truncate text-sm font-bold text-slate-900">{user.username}</p>
        </div>
        <div className="py-2">
          <Link
            href="/inicio"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => setProfileOpen(false)}
          >
            <UserIcon size={16} className="text-sl-navy" />
            <span>Ir ao portal</span>
          </Link>
          {hasPermission('portal.gestor.view') ? (
            <Link
              href="/gestor"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setProfileOpen(false)}
            >
              <LayoutDashboard size={16} className="text-sl-navy" />
              <span>Área do gestor</span>
            </Link>
          ) : null}
          <Link
            href="/perfil"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => setProfileOpen(false)}
          >
            <UserIcon size={16} className="text-sl-navy" />
            <span>Meu perfil</span>
          </Link>
        </div>
        <div className="border-t border-slate-100">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-red-600 transition-colors hover:bg-red-50"
            onClick={async () => {
              setProfileOpen(false);
              await logout();
            }}
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </FloatingDropdownPortal>
    </div>
  );
}
