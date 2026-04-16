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

  const canMetas = hasPermission('VIEW_COMERCIAL_AUDITORIA');
  const canRobo = hasPermission('VIEW_COMERCIAL_ROBO_SUPREMO');
  const canEnter = canMetas || canRobo || hasPermission('module.comercial.view');
  if (!canEnter) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao módulo Comercial." />;
  }

  let body: React.ReactNode;
  switch (page) {
    case Page.COMERCIAL_ROBO_SUPREMO:
      if (!canRobo && !hasPermission('module.comercial.view')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso ao Robô Supremo." />;
      } else {
        body = <ComercialRoboSupremo />;
      }
      break;
    case Page.COMERCIAL_AUDITORIA:
    default:
      if (!canMetas && !hasPermission('module.comercial.view')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso a Metas e auditoria." />;
      } else {
        body = <ComercialAuditoria />;
      }
  }

  return (
    <div key={pathname} className="animate-in fade-in duration-200">
      {body}
    </div>
  );
}
