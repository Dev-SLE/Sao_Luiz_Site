'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';
import { patrimonioSlugFromPathname } from '@/modules/patrimonio/routes';
import { PatrimonioAtivosPage } from '@/modules/patrimonio/pages/PatrimonioAtivosPage';
import {
  PatrimonioBaixasPage,
  PatrimonioConferenciasPage,
  PatrimonioConfigPage,
  PatrimonioManutencoesPage,
  PatrimonioMovimentacoesPage,
} from '@/modules/patrimonio/pages/PatrimonioOperacaoPages';

export function PatrimonioModule({ pathname }: { pathname: string }) {
  const { hasPermission } = useData();
  const router = useRouter();
  const pathNorm = (pathname || '').replace(/\/+$/, '') || '/';
  useEffect(() => {
    if (pathNorm === '/app/patrimonio' || pathNorm === '/app/patrimonio/') {
      router.replace('/app/patrimonio/ativos');
    }
  }, [pathNorm, router]);

  if (!hasPermission('module.patrimonio.view')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao módulo Patrimônio." />;
  }

  const slug = patrimonioSlugFromPathname(pathname);

  switch (slug) {
    case 'movimentacoes':
      return <PatrimonioMovimentacoesPage />;
    case 'manutencoes':
      return <PatrimonioManutencoesPage />;
    case 'baixas':
      return <PatrimonioBaixasPage />;
    case 'conferencia':
      return <PatrimonioConferenciasPage />;
    case 'configuracoes':
      return <PatrimonioConfigPage />;
    case 'ativos':
    default:
      return <PatrimonioAtivosPage />;
  }
}
