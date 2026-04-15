'use client';

import React from 'react';
import clsx from 'clsx';
import type { WorkspaceModuleUx } from '@/lib/workspace-module-ux';
import { WorkspaceUserChrome } from '@/components/workspace/WorkspaceUserChrome';

type ChromeVariant = 'default' | 'crm' | 'comercial' | 'hub';

export function ModuleWorkspaceBanner({
  ux,
  chromeVariant = 'default',
  pageTitle,
}: {
  ux: WorkspaceModuleUx;
  chromeVariant?: ChromeVariant;
  /** Título curto da vista (ex.: Pendências, CRM — Funil). */
  pageTitle: string;
}) {
  const compactChrome = chromeVariant === 'crm';

  return (
    <div className={clsx('relative', ux.headerBarClass)}>
      <div
        className={clsx(
          'relative z-10 flex flex-row items-center justify-between gap-3',
          compactChrome ? 'sm:gap-3' : 'sm:gap-4',
        )}
      >
        <h1
          className={clsx(
            'font-heading min-w-0 flex-1 truncate font-bold tracking-tight text-sl-navy',
            compactChrome ? 'text-base md:text-lg' : 'text-lg md:text-xl',
          )}
        >
          {pageTitle}
        </h1>
        <WorkspaceUserChrome variant={chromeVariant} />
      </div>
    </div>
  );
}
