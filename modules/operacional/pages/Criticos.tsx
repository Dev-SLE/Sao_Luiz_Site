'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import DataTable from '@/components/DataTable';
import { CteData } from '@/types';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function CriticosPage({ onNoteClick }: { onNoteClick: (cte: CteData) => void }) {
  const { criticos, setCriticosPage, setCriticosLimit, hasPermission } = useData();
  if (!hasPermission('VIEW_CRITICOS')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso às Pendências Críticas." />;
  }
  return (
    <DataTable
      title="Pendências Críticas"
      data={criticos.data}
      onNoteClick={onNoteClick}
      enableFilters={true}
      isCriticalView={true}
      serverPagination={{
        page: criticos.page,
        limit: criticos.limit,
        total: criticos.total,
        onPageChange: setCriticosPage,
        onLimitChange: setCriticosLimit,
      }}
    />
  );
}
