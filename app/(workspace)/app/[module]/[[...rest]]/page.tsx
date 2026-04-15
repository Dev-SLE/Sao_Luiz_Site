'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WorkspaceApp } from '@/App';

export default function WorkspaceModulePage() {
  const pathname = usePathname() || '/app';
  const router = useRouter();
  const workspaceClient = useMemo(
    () => ({
      pathname,
      push: (href: string) => router.push(href),
    }),
    [pathname, router],
  );

  return <WorkspaceApp workspaceClient={workspaceClient} />;
}
