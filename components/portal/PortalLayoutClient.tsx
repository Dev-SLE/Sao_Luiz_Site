'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Navbar } from '@/components/portal/Navbar';
import { PortalFooter } from '@/components/portal/PortalFooter';
import { isPortalPathAllowed, matchPortalRouteRule } from '@/lib/portal-route-permissions';

export default function PortalLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { hasPermission, loading: dataLoading } = useData();
  const pathname = usePathname() || '/';
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const routeRule = useMemo(() => matchPortalRouteRule(pathname), [pathname]);
  const allowed = useMemo(
    () => isPortalPathAllowed(pathname, hasPermission, user?.role),
    [pathname, hasPermission, user?.role],
  );

  if (loading) {
    return (
      <div data-theme="portal" className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Carregando portal…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (dataLoading) {
    return (
      <div data-theme="portal" className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Carregando permissões…</p>
      </div>
    );
  }

  if (routeRule && !allowed) {
    return (
      <div
        data-theme="portal"
        className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground"
      >
        <h1 className="font-heading text-2xl font-bold text-sl-navy">Acesso não autorizado</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          O seu perfil não tem permissão para esta área do portal. Peça ao administrador para ajustar o perfil
          associado ao seu utilizador.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {hasPermission('portal.home.view') ? (
            <Link
              href="/inicio"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Ir ao início
            </Link>
          ) : null}
          <Link
            href="/login"
            className="rounded-xl bg-sl-red px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-105"
          >
            Trocar de conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="portal" className="min-h-dvh bg-background font-body text-foreground">
      <Navbar />
      <div className="pt-16">
        <main>{children}</main>
      </div>
      <PortalFooter />
    </div>
  );
}
