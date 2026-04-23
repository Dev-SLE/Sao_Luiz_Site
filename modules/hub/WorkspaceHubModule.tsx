'use client';

import React from 'react';
import { pathToPage, moduleLabel } from '@/lib/workspace-routes';
import { HUB_PAGE_TITLES } from '@/modules/hub/hub-page-titles';
import { GerencialHubContent } from '@/modules/gerencial/GerencialHubContent';

/**
 * Conteúdo do hub (manifestos, gerencial, etc.). O cabeçalho e navegação ficam em HubLayout.
 */
export function WorkspaceHubModule({ pathname, moduleKey }: { pathname: string; moduleKey: string }) {
  const page = pathToPage(pathname);
  const title = HUB_PAGE_TITLES[page] ?? moduleLabel(moduleKey);

  if (moduleKey === 'gerencial') {
    return <GerencialHubContent pathname={pathname} />;
  }

  return (
    <div className="surface-card max-w-2xl p-8 animate-in fade-in duration-200">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Módulo em evolução: indicadores, integrações e fluxos desta área serão disponibilizados aqui nas próximas
        entregas.
      </p>
    </div>
  );
}
