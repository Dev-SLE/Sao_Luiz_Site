import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { BreadcrumbItem } from '@/components/workspace/ModuleShell';
import type { WorkspaceModuleUx } from '@/lib/workspace-module-ux';

type Props = {
  ux: WorkspaceModuleUx;
  breadcrumbs: BreadcrumbItem[];
  toolbar?: React.ReactNode;
  className?: string;
};

export function WorkspaceBreadcrumbPanel({ ux, breadcrumbs, toolbar, className }: Props) {
  return (
    <div className={clsx('space-y-3 px-4 py-3 md:px-5', ux.contentPanelClass, className)}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-slate-300">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="font-medium text-sl-navy hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      {toolbar ? <div className="border-t border-slate-100/80 pt-3">{toolbar}</div> : null}
    </div>
  );
}
