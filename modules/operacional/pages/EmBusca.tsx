'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import DataTable from '@/components/DataTable';
import { CteData } from '@/types';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function EmBuscaPage({ onNoteClick }: { onNoteClick: (cte: CteData) => void }) {
  const { emBusca, setEmBuscaPage, setEmBuscaLimit, hasPermission } = useData();
  if (!hasPermission('VIEW_EM_BUSCA')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso à tela de Mercadorias em Busca." />;
  }
  return (
    <DataTable
      title="Mercadorias em Busca"
      data={emBusca.data}
      onNoteClick={onNoteClick}
      enableFilters={true}
      ignoreUnitFilter={true}
      serverPagination={{
        page: emBusca.page,
        limit: emBusca.limit,
        total: emBusca.total,
        onPageChange: setEmBuscaPage,
        onLimitChange: setEmBuscaLimit,
      }}
    />
  );
}
