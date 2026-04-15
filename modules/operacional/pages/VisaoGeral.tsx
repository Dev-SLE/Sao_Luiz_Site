'use client';

import React from 'react';
import { useData } from '@/context/DataContext';
import Dashboard from '@/components/Dashboard';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function VisaoGeralPage() {
  const { hasPermission } = useData();
  if (!hasPermission('VIEW_DASHBOARD')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao Dashboard Operacional." />;
  }
  return <Dashboard />;
}
