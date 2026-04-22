'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import OcorrenciasHub from '@/components/OcorrenciasHub';
import { CteData } from '@/types';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function OcorrenciasPage({ onNoteClick }: { onNoteClick: (cte: CteData) => void }) {
  const { ocorrencias, setOcorrenciasPage, setOcorrenciasLimit, hasPermission } = useData();
  if (!hasPermission('tab.operacional.ocorrencias.view') && !hasPermission('tab.operacional.dossie.view')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso à tela de Ocorrências." />;
  }
  return (
    <OcorrenciasHub
      data={ocorrencias.data}
      onNoteClick={onNoteClick}
      hasDossieView={hasPermission('tab.operacional.dossie.view')}
      hasFinanceAttach={hasPermission('dossie.financeiro.attach')}
      serverPagination={{
        page: ocorrencias.page,
        limit: ocorrencias.limit,
        total: ocorrencias.total,
        onPageChange: setOcorrenciasPage,
        onLimitChange: setOcorrenciasLimit,
      }}
    />
  );
}
