'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import DataTable from '@/components/DataTable';
import { CteData } from '@/types';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function ConcluidosPage({ onNoteClick }: { onNoteClick: (cte: CteData) => void }) {
  const { concluidos, setConcluidosPage, setConcluidosLimit, hasPermission } = useData();
  if (!hasPermission('VIEW_CONCLUIDOS')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso à tela de Concluídos." />;
  }
  return (
    <DataTable
      title="Concluídos"
      data={concluidos.data}
      onNoteClick={onNoteClick}
      enableFilters={true}
      serverPagination={{
        page: concluidos.page,
        limit: concluidos.limit,
        total: concluidos.total,
        onPageChange: setConcluidosPage,
        onLimitChange: setConcluidosLimit,
      }}
    />
  );
}
