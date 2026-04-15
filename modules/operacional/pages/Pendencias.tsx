'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import DataTable from '@/components/DataTable';
import { CteData } from '@/types';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function PendenciasPage({ onNoteClick }: { onNoteClick: (cte: CteData) => void }) {
  const { pendencias, setPendenciasPage, setPendenciasLimit, hasPermission } = useData();
  if (!hasPermission('VIEW_PENDENCIAS')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao Painel de Pendências." />;
  }
  return (
    <DataTable
      title="Painel de Pendências"
      data={pendencias.data}
      onNoteClick={onNoteClick}
      isPendencyView={true}
      serverPagination={{
        page: pendencias.page,
        limit: pendencias.limit,
        total: pendencias.total,
        onPageChange: setPendenciasPage,
        onLimitChange: setPendenciasLimit,
      }}
    />
  );
}
