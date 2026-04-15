'use client';

import React from 'react';
import { getWorkspaceModuleUx } from '@/lib/workspace-module-ux';
import { ModuleWorkspaceBanner } from '@/components/workspace/ModuleWorkspaceBanner';
import { getWorkspacePageTitle } from '@/lib/workspace-page-title';

export function CrmLayout({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const ux = getWorkspaceModuleUx('crm');
  const isCrmDense = pathname.includes('/crm/funil') || pathname.includes('/crm/chat');

  return (
    <div
      className={isCrmDense ? 'flex min-h-0 flex-1 flex-col gap-0 overflow-hidden' : 'flex min-h-0 flex-1 flex-col gap-0'}
      data-workspace-module="crm"
    >
      <ModuleWorkspaceBanner ux={ux} chromeVariant="crm" pageTitle={getWorkspacePageTitle(pathname)} />
      <div className={isCrmDense ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-0' : 'min-h-0 flex-1 px-0'}>
        {children}
      </div>
    </div>
  );
}
