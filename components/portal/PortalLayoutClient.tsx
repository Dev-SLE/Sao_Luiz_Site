'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/portal/Navbar';
import { PortalFooter } from '@/components/portal/PortalFooter';

export default function PortalLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
        <main>{children}</main>
      </div>
      <PortalFooter />
    </div>
  );
}
