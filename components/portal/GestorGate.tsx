'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/context/DataContext';

export function GestorGate({ children }: { children: React.ReactNode }) {
  const { hasPermission } = useData();
  const router = useRouter();

  useEffect(() => {
    if (!hasPermission('portal.gestor.view')) {
      router.replace('/inicio');
    }
  }, [hasPermission, router]);

  if (!hasPermission('portal.gestor.view')) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 pt-24 text-sm text-muted-foreground">
        Verificando permissões…
      </div>
    );
  }

  return <>{children}</>;
}
