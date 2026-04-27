'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

/**
 * Evita flash de "sem permissão" enquanto o DataContext ainda carrega perfis/permissões após login ou F5.
 */
export function WorkspacePermissionsBootstrap({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: dataLoading } = useData();

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-sl-navy" aria-hidden />
        <p className="text-sm">A validar sessão…</p>
      </div>
    );
  }

  if (user && !user.mustChangePassword && dataLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-sl-navy" aria-hidden />
        <p className="text-sm">A carregar permissões…</p>
      </div>
    );
  }

  return <>{children}</>;
}
