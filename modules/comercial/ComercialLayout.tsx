'use client';

import React from 'react';
import { getWorkspaceModuleUx } from '@/lib/workspace-module-ux';
import { ModuleWorkspaceBanner } from '@/components/workspace/ModuleWorkspaceBanner';
import { getWorkspacePageTitle } from '@/lib/workspace-page-title';

export function ComercialLayout({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const ux = getWorkspaceModuleUx('comercial');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0" data-workspace-module="comercial">
      <ModuleWorkspaceBanner ux={ux} chromeVariant="comercial" pageTitle={getWorkspacePageTitle(pathname)} />
      <div className="min-h-0 flex-1 px-0">{children}</div>
    </div>
  );
}
