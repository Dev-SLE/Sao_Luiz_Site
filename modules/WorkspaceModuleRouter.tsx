'use client';

import React from 'react';
import { Page, CteData } from '@/types';
import { parseWorkspacePath } from '@/lib/workspace-routes';
import { OperacionalLayout } from '@/modules/operacional/OperacionalLayout';
import { OperacionalModule } from '@/modules/operacional/OperacionalModule';
import { CrmLayout } from '@/modules/crm/CrmLayout';
import { CrmModule } from '@/modules/crm/CrmModule';
import { ComercialLayout } from '@/modules/comercial/ComercialLayout';
import { ComercialModule } from '@/modules/comercial/ComercialModule';
import { HubLayout } from '@/modules/hub/HubLayout';
import { WorkspaceHubModule } from '@/modules/hub/WorkspaceHubModule';
import { FinanceiroLayout } from '@/modules/financeiro/FinanceiroLayout';
import { FinanceiroModule } from '@/modules/financeiro/FinanceiroModule';
import { PatrimonioLayout } from '@/modules/patrimonio/PatrimonioLayout';
import { PatrimonioModule } from '@/modules/patrimonio/PatrimonioModule';
import { WorkspacePermissionsBootstrap } from '@/components/workspace/WorkspacePermissionsBootstrap';

const HUB_MODULES = new Set([
  'manifestos',
  'clientes',
  'fiscal',
  'rh',
  'compras',
  'juridico',
  'gerencial',
  'auditoria',
]);

export type WorkspaceModuleRouterProps = {
  pathname: string;
  onNoteClick: (cte: CteData) => void;
  navigateToPage: (p: Page) => void;
  tracking: { cte: string | null; serie: string | null };
  selectedCrmLeadId: string | null;
  setSelectedCrmLeadId: (id: string | null) => void;
  onOpenTracking: (cte: string, serie?: string) => void;
};

export function WorkspaceModuleRouter({
  pathname,
  onNoteClick,
  navigateToPage,
  tracking,
  selectedCrmLeadId,
  setSelectedCrmLeadId,
  onOpenTracking,
}: WorkspaceModuleRouterProps) {
  const { module } = parseWorkspacePath(pathname);
  const m = module ?? 'operacional';

  if (m === 'operacional') {
    return (
      <OperacionalLayout pathname={pathname}>
        <WorkspacePermissionsBootstrap>
          <OperacionalModule pathname={pathname} onNoteClick={onNoteClick} tracking={tracking} />
        </WorkspacePermissionsBootstrap>
      </OperacionalLayout>
    );
  }
  if (m === 'crm') {
    return (
      <CrmLayout pathname={pathname}>
        <WorkspacePermissionsBootstrap>
          <CrmModule
            pathname={pathname}
            selectedCrmLeadId={selectedCrmLeadId}
            setSelectedCrmLeadId={setSelectedCrmLeadId}
            navigateToPage={navigateToPage}
            onOpenTracking={onOpenTracking}
          />
        </WorkspacePermissionsBootstrap>
      </CrmLayout>
    );
  }
  if (m === 'comercial') {
    return (
      <ComercialLayout pathname={pathname}>
        <WorkspacePermissionsBootstrap>
          <ComercialModule pathname={pathname} />
        </WorkspacePermissionsBootstrap>
      </ComercialLayout>
    );
  }
  if (m === 'financeiro') {
    return (
      <FinanceiroLayout pathname={pathname}>
        <WorkspacePermissionsBootstrap>
          <FinanceiroModule pathname={pathname} />
        </WorkspacePermissionsBootstrap>
      </FinanceiroLayout>
    );
  }
  if (m === 'patrimonio') {
    return (
      <PatrimonioLayout pathname={pathname}>
        <WorkspacePermissionsBootstrap>
          <PatrimonioModule pathname={pathname} />
        </WorkspacePermissionsBootstrap>
      </PatrimonioLayout>
    );
  }
  if (HUB_MODULES.has(m)) {
    return (
      <HubLayout moduleKey={m} pathname={pathname}>
        {m === 'gerencial' ? (
          <WorkspacePermissionsBootstrap>
            <WorkspaceHubModule pathname={pathname} moduleKey={m} />
          </WorkspacePermissionsBootstrap>
        ) : (
          <WorkspaceHubModule pathname={pathname} moduleKey={m} />
        )}
      </HubLayout>
    );
  }

  return (
    <OperacionalLayout pathname={pathname}>
      <WorkspacePermissionsBootstrap>
        <OperacionalModule pathname={pathname} onNoteClick={onNoteClick} tracking={tracking} />
      </WorkspacePermissionsBootstrap>
    </OperacionalLayout>
  );
}
