import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  FileText,
  Columns3,
  FileSpreadsheet,
  Gavel,
  Home,
  KeyRound,
  Landmark,
  LineChart,
  Package,
  Settings,
  Shield,
  Sparkles,
  SlidersHorizontal,
  UserCircle2,
  Warehouse,
} from 'lucide-react';
import { Page } from '@/types';
import { canEditPortalContent } from '@/lib/portalEditorAccess';
import { pageToWorkspacePath } from '@/lib/workspace-routes';
import { OPERACIONAL_TABS, operacionalPath } from '@/modules/operacional/routes';
import { CRM_TABS, crmPath } from '@/modules/crm/routes';
import { COMERCIAL_TABS, comercialPath } from '@/modules/comercial/routes';
/** Itens planejados só aparecem com `NEXT_PUBLIC_SHOW_PLANNED_NAV=1`. */
export const SHOW_PLANNED_WORKSPACE_NAV = process.env.NEXT_PUBLIC_SHOW_PLANNED_NAV === '1';

/** Link filho no menu lateral (sub-rota do módulo). */
export type WorkspaceNavChild = {
  label: string;
  /** Sem `href` em itens `planned` = “Em breve”, sem navegação. */
  href?: string;
  count?: number;
  status?: 'implemented' | 'planned';
};

export type WorkspaceNavItem = {
  id: Page;
  label: string;
  icon: LucideIcon;
  count: number;
  /** Permissão canónica ou legada (filtro da entrada). */
  permission: string;
  /** Navegação por URL — entrada do módulo (home). */
  href: string;
  /** Prefixo para realce do item ativo (ex.: `/app/operacional`). */
  matchPrefix?: string;
  /** Sub-rotas mostradas no sidebar (accordion). */
  children?: WorkspaceNavChild[];
};

export type WorkspaceNavSection = {
  id: string;
  label: string;
  subtitle?: string;
  items: WorkspaceNavItem[];
  variant?: 'default' | 'minimal';
};

export type PortalNavLink = {
  label: string;
  href: string;
  /** Permissão principal (usada se `altPermissions` estiver vazio). */
  permission: string;
  /** Basta uma destas permissões adicionais (OR com `permission`). */
  altPermissions?: string[];
};

export const PORTAL_NAV_LINKS: PortalNavLink[] = [
  { label: 'Início', href: '/inicio', permission: 'portal.home.view' },
  { label: 'Comunicados', href: '/comunicados', permission: 'portal.comunicados.view' },
  { label: 'Documentos', href: '/documentos', permission: 'portal.documentos.view' },
  { label: 'Treinamentos', href: '/treinamentos', permission: 'portal.treinamentos.view' },
  { label: 'Campanhas', href: '/campanhas', permission: 'portal.campanhas.view' },
  { label: 'Agenda', href: '/agenda', permission: 'portal.agenda.view' },
  { label: 'Suporte', href: '/suporte', permission: 'portal.suporte.view' },
  { label: 'Solicitações', href: '/solicitacoes', permission: 'portal.solicitacoes.view' },
  { label: 'Gestor', href: '/gestor', permission: 'portal.gestor.view' },
  {
    label: 'Edição',
    href: '/portal-edicao',
    permission: 'portal.colaborador.editor',
    altPermissions: ['portal.gestor.content.manage'],
  },
];

export function filterPortalNavLinks(
  links: PortalNavLink[],
  hasPermission: (perm: string) => boolean,
  opts?: { role?: string | null; username?: string | null },
): PortalNavLink[] {
  return links.filter((l) => {
    if (l.href === '/portal-edicao') {
      return canEditPortalContent(hasPermission, opts);
    }
    const keys = [l.permission, ...(l.altPermissions || [])];
    return keys.some((k) => hasPermission(k));
  });
}

export function workspaceNavGroupId(sectionId: string, item: WorkspaceNavItem): string {
  return `${sectionId}:${item.matchPrefix ?? item.href}`;
}

function normalizePath(p: string) {
  return p.replace(/\/+$/, '') || '/';
}

function trimNavChildren(children: WorkspaceNavChild[] | undefined): WorkspaceNavChild[] | undefined {
  if (!children?.length) return undefined;
  const out = children.filter((c) => {
    if (c.status === 'planned') return SHOW_PLANNED_WORKSPACE_NAV;
    return Boolean(c.href);
  });
  return out.length ? out : undefined;
}

function attachChildren(item: WorkspaceNavItem, children: WorkspaceNavChild[] | undefined): WorkspaceNavItem {
  const c = trimNavChildren(children);
  return c?.length ? { ...item, children: c } : { ...item, children: undefined };
}

/** Item filho ativo (rota exacta ou equivalente canónica). */
export function workspaceNavChildIsActive(pathname: string, childHref?: string): boolean {
  if (!childHref) return false;
  const p = normalizePath(pathname);
  const h = normalizePath(childHref);
  if (p === h) return true;
  if (h.endsWith('/visao-geral') && (p.endsWith('/operacional') || p.endsWith('/operacional/'))) return true;
  if (h.endsWith('/dashboard') && (p.endsWith('/crm') || p.endsWith('/crm/'))) return true;
  if (h.endsWith('/metas') && p.endsWith('/comercial')) return true;
  return false;
}

function operacionalChildCount(
  slug: string,
  counts: { pendencias: number; criticos: number; emBusca: number; ocorrencias: number; concluidos: number },
): number | undefined {
  if (slug === 'pendencias') return counts.pendencias > 0 ? counts.pendencias : undefined;
  if (slug === 'criticos') return counts.criticos > 0 ? counts.criticos : undefined;
  if (slug === 'em-busca') return counts.emBusca > 0 ? counts.emBusca : undefined;
  if (slug === 'ocorrencias') return counts.ocorrencias > 0 ? counts.ocorrencias : undefined;
  if (slug === 'concluidos') return counts.concluidos > 0 ? counts.concluidos : undefined;
  return undefined;
}

function buildOperacionalChildren(
  hasPermission: (perm: string) => boolean,
  counts: { pendencias: number; criticos: number; emBusca: number; ocorrencias: number; concluidos: number },
): WorkspaceNavChild[] {
  const out: WorkspaceNavChild[] = [];
  for (const t of OPERACIONAL_TABS) {
    const visible =
      hasPermission(t.permission) ||
      (t.slug === 'ocorrencias' && hasPermission('tab.operacional.dossie.view'));
    if (!visible) continue;
    const href = operacionalPath(t.slug);
    const c = operacionalChildCount(t.slug, counts);
    out.push({ label: t.label, href, status: 'implemented', ...(c !== undefined ? { count: c } : {}) });
  }
  return out;
}

function crmTabVisible(hasPermission: (perm: string) => boolean, tab: (typeof CRM_TABS)[number]): boolean {
  if (tab.permission === 'MANAGE_CRM_OPS') {
    return hasPermission('MANAGE_CRM_OPS');
  }
  if (tab.slug === 'contato-360') {
    return (
      hasPermission('VIEW_CRM_CHAT') ||
      hasPermission('VIEW_CRM_FUNIL') ||
      hasPermission('VIEW_CRM_DASHBOARD')
    );
  }
  return hasPermission(tab.permission);
}

function buildCrmChildren(hasPermission: (perm: string) => boolean): WorkspaceNavChild[] {
  return CRM_TABS.filter((t) => crmTabVisible(hasPermission, t)).map((t) => ({
    label: t.label,
    href: crmPath(t.slug),
    status: 'implemented' as const,
  }));
}

function buildComercialChildren(hasPermission: (perm: string) => boolean): WorkspaceNavChild[] {
  return COMERCIAL_TABS.filter((t) => hasPermission(t.permission)).map((t) => ({
    label: t.label,
    href: comercialPath(t.slug),
    status: 'implemented' as const,
  }));
}

function canSeeGerencialHubNav(hasPermission: (perm: string) => boolean): boolean {
  return (
    hasPermission('module.gerencial.view') ||
    hasPermission('tab.gerencial.setor.comercial.view') ||
    hasPermission('tab.gerencial.setor.financeiro.view') ||
    hasPermission('tab.gerencial.setor.operacao.view') ||
    hasPermission('module.financeiro.view')
  );
}

/** Exemplos de roadmap (só visíveis com NEXT_PUBLIC_SHOW_PLANNED_NAV=1). */
function plannedManifestosChildren(): WorkspaceNavChild[] {
  return [
    { label: 'Emissão e ciência', status: 'planned' },
    { label: 'Conferência fiscal', status: 'planned' },
  ];
}

function buildPatrimonioChildren(): WorkspaceNavChild[] {
  return [
    { label: 'Ativos', href: '/app/patrimonio/ativos', status: 'implemented' as const },
    { label: 'Movimentações', href: '/app/patrimonio/movimentacoes', status: 'implemented' as const },
    { label: 'Manutenções', href: '/app/patrimonio/manutencoes', status: 'implemented' as const },
    { label: 'Baixas', href: '/app/patrimonio/baixas', status: 'implemented' as const },
    { label: 'Conferência', href: '/app/patrimonio/conferencia', status: 'implemented' as const },
    { label: 'Configurações', href: '/app/patrimonio/configuracoes', status: 'implemented' as const },
  ];
}

export function buildWorkspaceNavSections(input: {
  hasPermission: (perm: string) => boolean;
  counts: {
    pendencias: number;
    criticos: number;
    emBusca: number;
    ocorrencias: number;
    concluidos: number;
  };
}): WorkspaceNavSection[] {
  const { hasPermission, counts } = input;

  const hub = (key: string) => hasPermission(key);

  const withHubHref = (
    page: Page,
    partial: Omit<WorkspaceNavItem, 'href' | 'matchPrefix' | 'children'>,
  ): WorkspaceNavItem => {
    const href = pageToWorkspacePath(page);
    return { ...partial, href, matchPrefix: href };
  };

  /** Camada módulo: sem `module.operacional.view` (após normalização no cliente) não exibe o bloco, mesmo com legado VIEW_* órfão. */
  const showOperacional = hasPermission('module.operacional.view');

  const opChildren = showOperacional ? buildOperacionalChildren(hasPermission, counts) : [];

  const operacionalMod: WorkspaceNavItem | false =
    showOperacional &&
    attachChildren(
      {
        id: Page.DASHBOARD,
        label: 'Operacional',
        icon: Home,
        count: hasPermission('VIEW_PENDENCIAS') ? counts.pendencias : 0,
        permission: 'VIEW_DASHBOARD',
        href: '/app/operacional/pendencias',
        matchPrefix: '/app/operacional',
      },
      opChildren,
    );

  const manifestosMod: WorkspaceNavItem | false =
    hub('module.manifestos.view') &&
    attachChildren(
      withHubHref(Page.MODULE_MANIFESTOS, {
        id: Page.MODULE_MANIFESTOS,
        label: 'Manifestos e CTEs',
        icon: FileSpreadsheet,
        count: 0,
        permission: 'module.manifestos.view',
      }),
      plannedManifestosChildren(),
    );

  const showCrm =
    hasPermission('VIEW_CRM_DASHBOARD') ||
    hasPermission('VIEW_CRM_FUNIL') ||
    hasPermission('VIEW_CRM_CHAT') ||
    hasPermission('MANAGE_CRM_OPS') ||
    hasPermission('module.crm.view');

  const crmChildren = showCrm ? buildCrmChildren(hasPermission) : [];

  const crmMod: WorkspaceNavItem | false =
    showCrm &&
    attachChildren(
      {
        id: Page.CRM_DASHBOARD,
        label: 'CRM',
        icon: Columns3,
        count: 0,
        permission: 'VIEW_CRM_DASHBOARD',
        href: '/app/crm/dashboard',
        matchPrefix: '/app/crm',
      },
      crmChildren,
    );

  const showComercial =
    hasPermission('module.comercial.view') ||
    hasPermission('VIEW_COMERCIAL_AUDITORIA') ||
    hasPermission('VIEW_COMERCIAL_ROBO_SUPREMO');
  const comercialChildren = showComercial ? buildComercialChildren(hasPermission) : [];

  const comercialMod: WorkspaceNavItem | false =
    showComercial &&
    attachChildren(
      {
        id: Page.COMERCIAL_AUDITORIA,
        label: 'Comercial',
        icon: LineChart,
        count: 0,
        permission: 'VIEW_RELATORIOS',
        href: '/app/comercial/metas',
        matchPrefix: '/app/comercial',
      },
      comercialChildren,
    );

  const clientesMod: WorkspaceNavItem | false =
    hub('module.clientes.view') &&
    withHubHref(Page.MODULE_CLIENTES, {
      id: Page.MODULE_CLIENTES,
      label: 'Clientes e tabelas de preço',
      icon: Building2,
      count: 0,
      permission: 'module.clientes.view',
    });

  const patrimonioMod: WorkspaceNavItem | false =
    hub('module.patrimonio.view') &&
    attachChildren(
      {
        ...withHubHref(Page.MODULE_PATRIMONIO, {
          id: Page.MODULE_PATRIMONIO,
          label: 'Patrimônio',
          icon: Warehouse,
          count: 0,
          permission: 'module.patrimonio.view',
        }),
        matchPrefix: '/app/patrimonio',
      },
      buildPatrimonioChildren(),
    );

  const financeiroMod: WorkspaceNavItem | false =
    (hub('module.financeiro.view') || hasPermission('tab.gerencial.setor.financeiro.view')) &&
    (() => {
      const href = pageToWorkspacePath(Page.MODULE_FINANCEIRO);
      return {
        id: Page.MODULE_FINANCEIRO,
        label: 'Financeiro',
        icon: Landmark,
        count: 0,
        permission: 'module.financeiro.view',
        href,
        matchPrefix: '/app/gerencial/financeiro',
      } satisfies WorkspaceNavItem;
    })();

  const fiscalMod: WorkspaceNavItem | false =
    hub('module.fiscal.view') &&
    withHubHref(Page.MODULE_FISCAL, {
      id: Page.MODULE_FISCAL,
      label: 'Fiscal',
      icon: FileSpreadsheet,
      count: 0,
      permission: 'module.fiscal.view',
    });

  const rhMod: WorkspaceNavItem | false =
    hub('module.rh.view') &&
    withHubHref(Page.MODULE_RH, {
      id: Page.MODULE_RH,
      label: 'DP / RH',
      icon: UserCircle2,
      count: 0,
      permission: 'module.rh.view',
    });

  const comprasMod: WorkspaceNavItem | false =
    hub('module.compras.view') &&
    withHubHref(Page.MODULE_COMPRAS, {
      id: Page.MODULE_COMPRAS,
      label: 'Compras',
      icon: Package,
      count: 0,
      permission: 'module.compras.view',
    });

  const juridicoMod: WorkspaceNavItem | false =
    hub('module.juridico.view') &&
    withHubHref(Page.MODULE_JURIDICO, {
      id: Page.MODULE_JURIDICO,
      label: 'Jurídico',
      icon: Gavel,
      count: 0,
      permission: 'module.juridico.view',
    });

  const gerencialChildren: WorkspaceNavChild[] = [];

  const gerencialMod: WorkspaceNavItem | false =
    canSeeGerencialHubNav(hasPermission) &&
    attachChildren(
      {
        id: Page.GERENCIAL_COMISSOES_BI,
        label: 'Gerencial',
        icon: LineChart,
        count: 0,
        permission: 'module.gerencial.view',
        href: '/app/gerencial',
        matchPrefix: '/app/gerencial',
      },
      gerencialChildren,
    );

  const auditoriaMod: WorkspaceNavItem | false =
    hub('module.auditoria.view') &&
    withHubHref(Page.MODULE_AUDITORIA_APP, {
      id: Page.MODULE_AUDITORIA_APP,
      label: 'Auditoria',
      icon: Shield,
      count: 0,
      permission: 'module.auditoria.view',
    });

  /** Camada dedicada: configuração, relatórios operacionais, Sofia, CRM admin. */
  const cfgSettings: WorkspaceNavItem | false =
    hasPermission('MANAGE_SETTINGS') && {
      id: Page.CONFIGURACOES,
      label: 'Configurações',
      icon: Settings,
      count: 0,
      permission: 'MANAGE_SETTINGS',
      href: '/app/operacional/configuracoes',
      matchPrefix: '/app/operacional/configuracoes',
    };

  const cfgRelatoriosOp: WorkspaceNavItem | false =
    hasPermission('VIEW_RELATORIOS') && {
      id: Page.RELATORIOS,
      label: 'Relatórios operacionais',
      icon: FileText,
      count: 0,
      permission: 'VIEW_RELATORIOS',
      href: '/app/operacional/relatorios',
      matchPrefix: '/app/operacional/relatorios',
    };

  const cfgSofia: WorkspaceNavItem | false =
    hasPermission('MANAGE_SOFIA') &&
    hasPermission('MANAGE_SETTINGS') && {
      id: Page.SOFIA_CONFIG,
      label: 'Sofia (assistente)',
      icon: Sparkles,
      count: 0,
      permission: 'MANAGE_SOFIA',
      href: '/app/operacional/sofia-config',
      matchPrefix: '/app/operacional/sofia-config',
    };

  const cfgSenha: WorkspaceNavItem = {
    id: Page.MUDAR_SENHA,
    label: 'Alterar senha',
    icon: KeyRound,
    count: 0,
    permission: 'workspace.app.view',
    href: '/app/operacional/mudar-senha',
    matchPrefix: '/app/operacional/mudar-senha',
  };

  const cfgCrmOps: WorkspaceNavItem | false =
    hasPermission('MANAGE_CRM_OPS') && {
      id: Page.CRM_OPS,
      label: 'CRM — Operação',
      icon: SlidersHorizontal,
      count: 0,
      permission: 'MANAGE_CRM_OPS',
      href: '/app/crm/operacao',
      matchPrefix: '/app/crm/operacao',
    };

  const cfgCrmPrivacy: WorkspaceNavItem | false =
    hasPermission('MANAGE_CRM_OPS') && {
      id: Page.CRM_PRIVACY,
      label: 'CRM — Privacidade',
      icon: Shield,
      count: 0,
      permission: 'MANAGE_CRM_OPS',
      href: '/app/crm/privacidade',
      matchPrefix: '/app/crm/privacidade',
    };

  const cfgCrmReports: WorkspaceNavItem | false =
    (hasPermission('VIEW_CRM_DASHBOARD') || hasPermission('MANAGE_CRM_OPS')) && {
      id: Page.CRM_REPORTS,
      label: 'CRM — Relatórios',
      icon: BarChart3,
      count: 0,
      permission: 'VIEW_CRM_DASHBOARD',
      href: '/app/crm/relatorios',
      matchPrefix: '/app/crm/relatorios',
    };

  const camadaConfig: WorkspaceNavItem[] = [
    cfgSettings,
    cfgRelatoriosOp,
    cfgSofia,
    cfgSenha,
    cfgCrmOps,
    cfgCrmPrivacy,
    cfgCrmReports,
  ].filter(Boolean) as WorkspaceNavItem[];

  const camada1: WorkspaceNavItem[] = [
    operacionalMod,
    manifestosMod,
    crmMod,
    comercialMod,
    clientesMod,
    patrimonioMod,
  ].filter(Boolean) as WorkspaceNavItem[];

  const camada2: WorkspaceNavItem[] = [financeiroMod, fiscalMod, rhMod, comprasMod, juridicoMod].filter(
    Boolean,
  ) as WorkspaceNavItem[];

  const camada3: WorkspaceNavItem[] = [gerencialMod, auditoriaMod].filter(Boolean) as WorkspaceNavItem[];

  const sections: WorkspaceNavSection[] = [];

  if (camada1.length) {
    sections.push({
      id: 'camada-1',
      label: 'Camada 1 — Núcleo transacional',
      variant: 'minimal',
      items: camada1,
    });
  }
  if (camada2.length) {
    sections.push({
      id: 'camada-2',
      label: 'Camada 2 — Suporte corporativo',
      variant: 'minimal',
      items: camada2,
    });
  }
  if (camada3.length) {
    sections.push({
      id: 'camada-3',
      label: 'Camada 3 — Governança',
      variant: 'minimal',
      items: camada3,
    });
  }
  if (camadaConfig.length) {
    sections.push({
      id: 'camada-4',
      label: 'Camada 4 — Configuração, relatórios e CRM admin',
      variant: 'minimal',
      items: camadaConfig,
    });
  }

  return sections;
}
