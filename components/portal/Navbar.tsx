'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { filterPortalNavLinks, PORTAL_NAV_LINKS } from '@/lib/navigation-manifest';
import { NotificationsCenter } from '@/components/notifications/NotificationsCenter';
import { GlobalSearchTrigger } from '@/components/search/GlobalSearchTrigger';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { hasPermission } = useData();
  const links = filterPortalNavLinks(PORTAL_NAV_LINKS, hasPermission);
  const showWorkspace = hasPermission('workspace.app.view');

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/15 bg-sl-navy/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/inicio" className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
            <img src="/sle-brand-kangaroo.png" alt="" className="h-full w-full object-cover object-center" draggable={false} />
          </div>
          <div className="hidden sm:block">
            <span className="font-heading text-sm font-semibold tracking-wide text-white">São Luiz Express</span>
          </div>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/inicio' && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {showWorkspace && (
            <Link
              href="/app/operacional/visao-geral"
              className="ml-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              Sistema
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          <GlobalSearchTrigger variant="portal" />
          <NotificationsCenter variant="portal" />
          <Link
            href="/perfil"
            className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            title="Meu perfil"
          >
            <span className="font-heading text-xs font-bold">EU</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-white/60 transition-colors hover:text-white lg:hidden"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-black/15 bg-sl-navy lg:hidden">
          <div className="space-y-1 px-6 py-4">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {showWorkspace && (
              <Link
                href="/app/operacional/visao-geral"
                onClick={() => setIsOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                Sistema
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
