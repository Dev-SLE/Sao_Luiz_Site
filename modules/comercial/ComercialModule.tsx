'use client';

import React from 'react';
import { Page } from '@/types';
import { pathToPage } from '@/lib/workspace-routes';
import { useData } from '@/context/DataContext';
import ComercialAuditoria from '@/components/ComercialAuditoria';
import ComercialRoboSupremo from '@/components/ComercialRoboSupremo';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export function ComercialModule({ pathname }: { pathname: string }) {
  const { hasPermission } = useData();
  const page = pathToPage(pathname);

  const can = hasPermission('VIEW_RELATORIOS') || hasPermission('MANAGE_SETTINGS');
  if (!can) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao módulo Comercial." />;
  }

  let body: React.ReactNode;
  switch (page) {
    case Page.COMERCIAL_ROBO_SUPREMO:
      body = <ComercialRoboSupremo />;
      break;
    case Page.COMERCIAL_AUDITORIA:
    default:
      body = <ComercialAuditoria />;
  }

  return (
    <div key={pathname} className="animate-in fade-in duration-200">
      {body}
    </div>
  );
}
