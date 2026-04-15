'use client';

import type { ReactNode } from 'react';
import { HubLayout } from '@/modules/hub/HubLayout';

export function FinanceiroLayout({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return (
    <HubLayout moduleKey="financeiro" pathname={pathname}>
      {children}
    </HubLayout>
  );
}
