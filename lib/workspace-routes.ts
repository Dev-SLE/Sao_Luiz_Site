import { Page } from '@/types';
import { isGerencialSectorSlug } from '@/modules/gerencial/routes';

/** Segmentos canônicos do workspace (fase_1.md). */
export const WORKSPACE_MODULES = [
  'operacional',
  'manifestos',
  'crm',
  'comercial',
  'clientes',
  'patrimonio',
  'financeiro',
  'fiscal',
  'rh',
  'compras',
  'juridico',
  'gerencial',
  'auditoria',
] as const;

export type WorkspaceModule = (typeof WORKSPACE_MODULES)[number];

export function isWorkspaceModule(s: string): s is WorkspaceModule {
  return (WORKSPACE_MODULES as readonly string[]).includes(s);
}

/** Primeiro segmento após `/app` (sem barra final). */
export function parseWorkspacePath(pathname: string): { module: string | null; rest: string[] } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (!clean.startsWith('/app')) return { module: null, rest: [] };
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] !== 'app') return { module: null, rest: [] };
  const moduleSeg = parts[1] ?? null;
  const rest = parts.slice(2);
  return { module: moduleSeg, rest };
}

/** Converte rota `/app/...` em `Page` do legado `App.tsx`. */
export function pathToPage(pathname: string): Page {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/gestor' || clean.startsWith('/gestor/')) return Page.PORTAL_GESTOR;
  const portalColabRoots = [
    '/inicio',
    '/comunicados',
    '/documentos',
    '/treinamentos',
    '/campanhas',
    '/agenda',
    '/suporte',
    '/solicitacoes',
  ] as const;
  if (portalColabRoots.some((b) => clean === b || clean.startsWith(`${b}/`))) return Page.PORTAL_COLABORADOR;

  const { module, rest } = parseWorkspacePath(pathname);
  const r0 = rest[0]?.toLowerCase() ?? '';

  if (!module || module === 'operacional') {
    if (!r0 || r0 === 'visao-geral' || r0 === 'dashboard') return Page.DASHBOARD;
    if (r0 === 'pendencias') return Page.PENDENCIAS;
    if (r0 === 'criticos') return Page.CRITICOS;
    if (r0 === 'em-busca') return Page.EM_BUSCA;
    if (r0 === 'ocorrencias') return Page.OCORRENCIAS;
    if (r0 === 'rastreio' || r0 === 'rastreio-operacional') return Page.RASTREIO_OPERACIONAL;
    if (r0 === 'concluidos') return Page.CONCLUIDOS;
    if (r0 === 'configuracoes') return Page.CONFIGURACOES;
    if (r0 === 'relatorios') return Page.RELATORIOS;
    if (r0 === 'sofia-config') return Page.SOFIA_CONFIG;
    if (r0 === 'mudar-senha') return Page.MUDAR_SENHA;
    return Page.DASHBOARD;
  }

  if (module === 'crm') {
    if (!r0 || r0 === 'dashboard') return Page.CRM_DASHBOARD;
    if (r0 === 'funil') return Page.CRM_FUNIL;
    if (r0 === 'chat') return Page.CRM_CHAT;
    if (r0 === 'operacao' || r0 === 'ops') return Page.CRM_OPS;
    if (r0 === 'tarefas' || r0 === 'pendencias') return Page.CRM_TASKS;
    if (r0 === 'relatorios') return Page.CRM_REPORTS;
    if (r0 === 'contato-360' || r0 === 'contact-360') return Page.CRM_CONTACT_360;
    if (r0 === 'privacidade') return Page.CRM_PRIVACY;
    return Page.CRM_DASHBOARD;
  }

  if (module === 'comercial') {
    if (!r0 || r0 === 'metas' || r0 === 'auditoria') return Page.COMERCIAL_AUDITORIA;
    if (r0 === 'robo-supremo') return Page.COMERCIAL_ROBO_SUPREMO;
    return Page.COMERCIAL_AUDITORIA;
  }

  if (module === 'manifestos') return Page.MODULE_MANIFESTOS;
  if (module === 'clientes') return Page.MODULE_CLIENTES;
  if (module === 'patrimonio') return Page.MODULE_PATRIMONIO;
  if (module === 'financeiro') return Page.MODULE_FINANCEIRO;
  if (module === 'fiscal') return Page.MODULE_FISCAL;
  if (module === 'rh') return Page.MODULE_RH;
  if (module === 'compras') return Page.MODULE_COMPRAS;
  if (module === 'juridico') return Page.MODULE_JURIDICO;
  if (module === 'gerencial') {
    const r1 = rest[1]?.toLowerCase() ?? '';
    const r2 = rest[2]?.toLowerCase() ?? '';
    if (isGerencialSectorSlug(r0)) {
      if (r1 === 'comissoes' && r2 === 'holerite') return Page.GERENCIAL_COMISSOES_HOLERITE;
      if (r1 === 'comissoes') return Page.GERENCIAL_COMISSOES_BI;
      return Page.MODULE_GERENCIAL;
    }
    if (r0 === 'comissoes' && r1 === 'holerite') return Page.GERENCIAL_COMISSOES_HOLERITE;
    if (r0 === 'comissoes') return Page.GERENCIAL_COMISSOES_BI;
    return Page.MODULE_GERENCIAL;
  }
  if (module === 'auditoria') return Page.MODULE_AUDITORIA_APP;

  return Page.DASHBOARD;
}

/** Caminho canônico mínimo para cada `Page`. */
export function pageToWorkspacePath(page: Page): string {
  switch (page) {
    case Page.DASHBOARD:
      return '/app/operacional/visao-geral';
    case Page.PENDENCIAS:
      return '/app/operacional/pendencias';
    case Page.CRITICOS:
      return '/app/operacional/criticos';
    case Page.EM_BUSCA:
      return '/app/operacional/em-busca';
    case Page.OCORRENCIAS:
      return '/app/operacional/ocorrencias';
    case Page.RASTREIO_OPERACIONAL:
      return '/app/operacional/rastreio-operacional';
    case Page.CONCLUIDOS:
      return '/app/operacional/concluidos';
    case Page.CRM_DASHBOARD:
      return '/app/crm/dashboard';
    case Page.CRM_FUNIL:
      return '/app/crm/funil';
    case Page.CRM_CHAT:
      return '/app/crm/chat';
    case Page.CRM_OPS:
      return '/app/crm/operacao';
    case Page.CRM_TASKS:
      return '/app/crm/tarefas';
    case Page.CRM_REPORTS:
      return '/app/crm/relatorios';
    case Page.CRM_CONTACT_360:
      return '/app/crm/contato-360';
    case Page.CRM_PRIVACY:
      return '/app/crm/privacidade';
    case Page.COMERCIAL_AUDITORIA:
      return '/app/comercial/metas';
    case Page.COMERCIAL_ROBO_SUPREMO:
      return '/app/comercial/robo-supremo';
    case Page.CONFIGURACOES:
      return '/app/operacional/configuracoes';
    case Page.SOFIA_CONFIG:
      return '/app/operacional/sofia-config';
    case Page.RELATORIOS:
      return '/app/operacional/relatorios';
    case Page.MUDAR_SENHA:
      return '/app/operacional/mudar-senha';
    case Page.MODULE_MANIFESTOS:
      return '/app/manifestos';
    case Page.MODULE_CLIENTES:
      return '/app/clientes';
    case Page.MODULE_PATRIMONIO:
      return '/app/patrimonio';
    case Page.MODULE_FINANCEIRO:
      return '/app/financeiro';
    case Page.MODULE_FISCAL:
      return '/app/fiscal';
    case Page.MODULE_RH:
      return '/app/rh';
    case Page.MODULE_COMPRAS:
      return '/app/compras';
    case Page.MODULE_JURIDICO:
      return '/app/juridico';
    case Page.MODULE_GERENCIAL:
      return '/app/gerencial/comercial';
    case Page.GERENCIAL_COMISSOES_BI:
      return '/app/gerencial/comercial/comissoes';
    case Page.GERENCIAL_COMISSOES_HOLERITE:
      return '/app/gerencial/comercial/comissoes/holerite';
    case Page.MODULE_AUDITORIA_APP:
      return '/app/auditoria';
    case Page.PORTAL_COLABORADOR:
      return '/inicio';
    case Page.PORTAL_GESTOR:
      return '/gestor';
    default:
      return '/app/operacional/visao-geral';
  }
}

export function moduleLabel(module: string): string {
  const labels: Record<string, string> = {
    operacional: 'Operacional',
    manifestos: 'Manifestos e CTEs',
    crm: 'CRM',
    comercial: 'Comercial',
    clientes: 'Clientes e tabelas de preço',
    patrimonio: 'Patrimônio',
    financeiro: 'Financeiro',
    fiscal: 'Fiscal',
    rh: 'DP / RH',
    compras: 'Compras e suprimentos',
    juridico: 'Jurídico / Compliance',
    gerencial: 'Gerencial',
    auditoria: 'Auditoria e controle',
  };
  return labels[module] ?? module;
}
