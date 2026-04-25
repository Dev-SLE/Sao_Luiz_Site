'use client';

import type { ReactNode } from 'react';
import { ModuleSubnavTabs } from '@/components/workspace/ModuleSubnavTabs';
import { ModuleWorkspaceBanner } from '@/components/workspace/ModuleWorkspaceBanner';
import { getWorkspacePageTitle } from '@/lib/workspace-page-title';
import { getWorkspaceModuleUx } from '@/lib/workspace-module-ux';
import { PATRIMONIO_TABS, patrimonioPath, patrimonioSlugFromPathname } from '@/modules/patrimonio/routes';

export function PatrimonioLayout({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const ux = getWorkspaceModuleUx('patrimonio');
  const slug = patrimonioSlugFromPathname(pathname);
  const tabs = PATRIMONIO_TABS.map((t) => ({
    href: patrimonioPath(t.slug),
    label: t.label,
    active: t.slug === slug,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0" data-workspace-module="patrimonio">
      <div className="relative border-b border-border bg-transparent px-4 py-2 md:px-6 md:py-2.5">
        <ModuleWorkspaceBanner ux={ux} chromeVariant="hub" pageTitle={getWorkspacePageTitle(pathname)} />
        <div className="mt-2 border-t border-slate-100 pt-1">
          <ModuleSubnavTabs tabs={tabs} size="sm" underlineClass="after:bg-amber-600" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-50/50 px-4 py-4 md:px-6">{children}</div>
    </div>
  );
}
