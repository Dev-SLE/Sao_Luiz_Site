'use client';

import { WorkspaceHubModule } from '@/modules/hub/WorkspaceHubModule';

export function PatrimonioModule({ pathname }: { pathname: string }) {
  return <WorkspaceHubModule pathname={pathname} moduleKey="patrimonio" />;
}
