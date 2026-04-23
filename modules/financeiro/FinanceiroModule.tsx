'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { gerencialHubPath } from '@/modules/gerencial/routes';

/** O BI financeiro ficou no Gerencial (setor Financeiro); `/app/financeiro/*` redireciona no middleware e aqui. */
export function FinanceiroModule({ pathname: _pathname }: { pathname: string }) {
  const router = useRouter();

  useEffect(() => {
    const qs =
      typeof window !== 'undefined' ? String(window.location.search || '').replace(/^\?/, '').trim() : '';
    const target = `${gerencialHubPath('financeiro', 'bi-inicial')}${qs ? `?${qs}` : ''}`;
    router.replace(target);
  }, [router]);

  return (
    <div className="surface-card max-w-md p-6 text-center text-sm text-slate-600">
      Redirecionando para Gerencial → Financeiro…
    </div>
  );
}
