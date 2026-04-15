import { Page } from '@/types';
import { pathToPage } from '@/lib/workspace-routes';

export type OperacionalTab = {
  slug: string;
  label: string;
  permission: string;
};

/** Abas internas do módulo Operacional (URLs canónicas em `workspace-routes.ts`). */
export const OPERACIONAL_TABS: OperacionalTab[] = [
  { slug: 'visao-geral', label: 'Visão geral', permission: 'VIEW_DASHBOARD' },
  { slug: 'pendencias', label: 'Pendências', permission: 'VIEW_PENDENCIAS' },
  { slug: 'criticos', label: 'Críticos', permission: 'VIEW_CRITICOS' },
  { slug: 'em-busca', label: 'Em busca', permission: 'VIEW_EM_BUSCA' },
  { slug: 'ocorrencias', label: 'Ocorrências', permission: 'tab.operacional.ocorrencias.view' },
  { slug: 'rastreio-operacional', label: 'Rastreio', permission: 'VIEW_RASTREIO_OPERACIONAL' },
  { slug: 'concluidos', label: 'Concluídos', permission: 'VIEW_CONCLUIDOS' },
];

export type OperacionalUtilityTab = {
  slug: string;
  label: string;
  /** `__always__` = qualquer utilizador autenticado no workspace */
  permission: string;
};

/** Rotas sob `/app/operacional/*` (config, relatórios, etc.) — entradas filhas no menu lateral (manifest). */
export const OPERACIONAL_UTILITY_TABS: OperacionalUtilityTab[] = [
  { slug: 'configuracoes', label: 'Configurações', permission: 'VIEW_SETTINGS' },
  { slug: 'relatorios', label: 'Relatórios', permission: 'VIEW_RELATORIOS' },
  { slug: 'sofia-config', label: 'Sofia', permission: 'MANAGE_SOFIA' },
  { slug: 'mudar-senha', label: 'Senha', permission: '__always__' },
];

export function operacionalPath(slug: string) {
  return `/app/operacional/${slug}`;
}

/** Rotas operacionais sem aba (config, relatórios, etc.). */
export function isOperacionalUtilityPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  const util = ['configuracoes', 'relatorios', 'sofia-config', 'mudar-senha'];
  return util.some((u) => p.endsWith(`/operacional/${u}`));
}

export function operacionalPageFromPath(pathname: string): Page {
  return pathToPage(pathname);
}
