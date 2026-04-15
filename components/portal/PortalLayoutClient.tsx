'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import Link from 'next/link';
import { Navbar } from '@/components/portal/Navbar';
import { PortalFooter } from '@/components/portal/PortalFooter';

export default function PortalLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { hasPermission } = useData();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

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

  return (
    <div data-theme="portal" className="min-h-dvh bg-background font-body text-foreground">
      <Navbar />
      <div className="pt-16">
        {hasPermission('workspace.app.view') && (
          <div className="border-b border-border bg-card px-6 py-2 text-sm">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
              <span className="text-muted-foreground">Sistema integrado:</span>
              <Link
                href="/app/operacional/visao-geral"
                className="rounded-lg bg-sl-navy px-3 py-1.5 font-medium text-white hover:bg-sl-navy-light"
              >
                Área de trabalho
              </Link>
            </div>
          </div>
        )}
        <main>{children}</main>
      </div>
      <PortalFooter />
    </div>
  );
}
