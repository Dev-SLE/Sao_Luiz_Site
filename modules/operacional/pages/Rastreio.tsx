'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import OperationalTracking from '@/components/OperationalTracking';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function RastreioPage({
  initialCte,
  initialSerie,
}: {
  initialCte: string | null;
  initialSerie: string | null;
}) {
  const { hasPermission } = useData();
  if (!hasPermission('VIEW_RASTREIO_OPERACIONAL')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao Rastreio Operacional." />;
  }
  return <OperationalTracking initialCte={initialCte} initialSerie={initialSerie} />;
}
