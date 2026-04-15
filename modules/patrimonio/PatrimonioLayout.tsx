'use client';

import type { ReactNode } from 'react';
import { HubLayout } from '@/modules/hub/HubLayout';

export function PatrimonioLayout({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return (
    <HubLayout moduleKey="patrimonio" pathname={pathname}>
      {children}
    </HubLayout>
  );
}
