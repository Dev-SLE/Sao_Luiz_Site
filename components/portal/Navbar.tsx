'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, PenLine } from 'lucide-react';
import clsx from 'clsx';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { filterPortalNavLinks, PORTAL_NAV_LINKS } from '@/lib/navigation-manifest';
import { canEditPortalContent } from '@/lib/portalEditorAccess';
import { NotificationsCenter } from '@/components/notifications/NotificationsCenter';

const WORKSPACE_HREF = '/app/gerencial/operacao/visao-geral-operacional';

function portalTabClass(active: boolean) {
  return clsx(
    'relative isolate overflow-hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold tracking-tight outline-none transition-all duration-300 ease-out',
    'focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-sl-navy',
    active
      ? 'bg-sl-red text-white shadow-[0_4px_14px_rgba(196,18,48,0.35)] ring-1 ring-white/25'
      : 'text-white/65 hover:bg-white/[0.12] hover:text-white hover:shadow-sm active:scale-[0.98]',
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPermission } = useData();
  const links = filterPortalNavLinks(PORTAL_NAV_LINKS, hasPermission, { role: user?.role, username: user?.username });
  const canPortalEdit = canEditPortalContent(hasPermission, { role: user?.role, username: user?.username });
  const showWorkspace = hasPermission('workspace.app.view');
  const isWorkspaceActive = Boolean(pathname?.startsWith('/app'));

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/15 bg-sl-navy/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/inicio" className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20 shadow-sm">
            <img
              src="/sle-brand-kangaroo.png"
              alt=""
              className="h-full w-full object-cover object-center"
              draggable={false}
            />
          </div>
          <div className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="font-heading truncate text-[13px] font-bold tracking-tight text-white">
              São Luiz Express
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Portal
            </span>
          </div>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex">
          {links.map((link) => {
            const isActive =
              pathname === link.href || (link.href !== '/inicio' && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.label}
                href={link.href}
                className={clsx('group', portalTabClass(isActive))}
              >
                {!isActive ? (
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
          {showWorkspace ? (
            <>
              <span className="mx-1 hidden h-7 w-px shrink-0 bg-white/15 lg:block" aria-hidden />
              <Link href={WORKSPACE_HREF} className={clsx('group', portalTabClass(isWorkspaceActive))}>
                {!isWorkspaceActive ? (
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10">Área de trabalho</span>
              </Link>
            </>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {canPortalEdit ? (
            <Link
              href="/portal-edicao"
              className="hidden items-center gap-1.5 rounded-lg border border-white/25 bg-sl-red/90 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-sl-red lg:inline-flex"
              title="Editar conteúdo do portal"
            >
              <PenLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Editar
            </Link>
          ) : null}
          <NotificationsCenter variant="portal" />
          <Link
            href="/perfil"
            className="rounded-lg p-2 text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            title="Meu perfil"
          >
            <span className="font-heading text-xs font-bold">EU</span>
          </Link>
          {canPortalEdit ? (
            <Link
              href="/portal-edicao"
              className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-sl-red/90 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white lg:hidden"
              title="Editar portal"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg p-2 text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white lg:hidden"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="border-t border-black/15 bg-sl-navy lg:hidden">
          <div className="space-y-1 px-4 py-3 sm:px-6">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/inicio' && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={clsx('group', portalTabClass(isActive), 'block w-full text-center')}
                >
                  {!isActive ? (
                    <span
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
            {showWorkspace ? (
              <Link
                href={WORKSPACE_HREF}
                onClick={() => setIsOpen(false)}
                className={clsx('group', portalTabClass(isWorkspaceActive), 'block w-full text-center')}
              >
                {!isWorkspaceActive ? (
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10">Área de trabalho</span>
              </Link>
            ) : null}
            {canPortalEdit ? (
              <Link
                href="/portal-edicao"
                onClick={() => setIsOpen(false)}
                className={clsx('group', portalTabClass(pathname === '/portal-edicao'), 'block w-full text-center')}
              >
                {pathname !== '/portal-edicao' ? (
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  <PenLine className="h-4 w-4" aria-hidden />
                  Editar portal
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
