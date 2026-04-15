'use client';

import { WorkspaceHubModule } from '@/modules/hub/WorkspaceHubModule';

export function FinanceiroModule({ pathname }: { pathname: string }) {
  return <WorkspaceHubModule pathname={pathname} moduleKey="financeiro" />;
}
