import { isAdminSuperRole } from '@/lib/adminSuperRoles';
import { hasPermissionWithAliases } from '@/lib/permissions';
import { normalizeOperacionalPermissionsForSession, OPERACIONAL_MODULE_KEY } from '@/lib/workspacePermissionNormalize';
import { OPERACIONAL_TABS, operacionalPath } from '@/modules/operacional/routes';
import { CRM_TABS, crmPath } from '@/modules/crm/routes';
import { COMERCIAL_TABS, comercialPath } from '@/modules/comercial/routes';

function can(perms: string[], key: string): boolean {
  if (!key) return false;
  return hasPermissionWithAliases(perms, key) || perms.includes(key);
}

/** Primeira aba operacional à qual o perfil tem acesso (ordem do menu). */
export function getFirstOperacionalEntryPath(perms: string[]): string | null {
  if (!can(perms, OPERACIONAL_MODULE_KEY)) return null;
  for (const t of OPERACIONAL_TABS) {
    if (can(perms, t.permission)) return operacionalPath(t.slug);
  }
  if (can(perms, 'tab.operacional.dossie.view')) {
    return operacionalPath('ocorrencias');
  }
  return operacionalPath('visao-geral');
}

function getFirstCrmEntryPath(perms: string[]): string | null {
  const hasCrm =
    can(perms, 'module.crm.view') ||
    can(perms, 'VIEW_CRM_DASHBOARD') ||
    can(perms, 'VIEW_CRM_FUNIL') ||
    can(perms, 'VIEW_CRM_CHAT') ||
    can(perms, 'MANAGE_CRM_OPS');
  if (!hasCrm) return null;
  for (const t of CRM_TABS) {
    if (t.slug === 'contato-360') {
      if (can(perms, 'VIEW_CRM_CHAT') || can(perms, 'VIEW_CRM_FUNIL') || can(perms, 'VIEW_CRM_DASHBOARD')) {
        return crmPath(t.slug);
      }
      continue;
    }
    if (t.permission === 'MANAGE_CRM_OPS' && !can(perms, 'MANAGE_CRM_OPS')) continue;
    if (can(perms, t.permission)) return crmPath(t.slug);
  }
  return crmPath('dashboard');
}

function getFirstComercialEntryPath(perms: string[]): string | null {
  const hasComercial =
    can(perms, 'module.comercial.view') ||
    can(perms, 'VIEW_COMERCIAL_AUDITORIA') ||
    can(perms, 'VIEW_COMERCIAL_ROBO_SUPREMO');
  if (!hasComercial) return null;
  for (const t of COMERCIAL_TABS) {
    if (can(perms, t.permission)) return comercialPath(t.slug);
  }
  return comercialPath('metas');
}

function hasGerencialHub(perms: string[]): boolean {
  return (
    can(perms, 'module.gerencial.view') ||
    can(perms, 'tab.gerencial.setor.comercial.view') ||
    can(perms, 'tab.gerencial.setor.financeiro.view') ||
    can(perms, 'tab.gerencial.setor.operacao.view')
  );
}

function hasAnyPortalRoute(perms: string[]): boolean {
  const portalKeys = [
    'portal.home.view',
    'portal.comunicados.view',
    'portal.documentos.view',
    'portal.treinamentos.view',
    'portal.campanhas.view',
    'portal.agenda.view',
    'portal.suporte.view',
    'portal.perfil.view',
    'portal.meu_ponto.view',
    'portal.minha_escala.view',
    'portal.holerite.view',
    'portal.solicitacoes.view',
    'portal.gestor.view',
    'portal.colaborador.editor',
    'portal.gestor.content.manage',
  ];
  return portalKeys.some((k) => can(perms, k));
}

/**
 * Destino pós-login: primeiro módulo realmente acessível (evita cair em Visão geral sem permissão).
 */
export function getDefaultPostLoginPath(
  permissions: string[] | null | undefined,
  role: string | null | undefined,
  username?: string | null | undefined,
): string {
  const raw = (permissions || []).map((p) => String(p).trim()).filter(Boolean);
  const perms = normalizeOperacionalPermissionsForSession(raw);

  if (perms.includes('*') || perms.includes('admin.*') || isAdminSuperRole(role, username)) {
    return '/app/operacional/visao-geral';
  }

  if (hasGerencialHub(perms)) {
    return '/app/gerencial';
  }

  const comercialPathHit = getFirstComercialEntryPath(perms);
  if (comercialPathHit) return comercialPathHit;

  const crmPathHit = getFirstCrmEntryPath(perms);
  if (crmPathHit) return crmPathHit;

  const opPath = getFirstOperacionalEntryPath(perms);
  if (opPath) return opPath;

  if (can(perms, 'MANAGE_SETTINGS')) {
    return '/app/operacional/configuracoes';
  }
  if (can(perms, 'MANAGE_SOFIA') && can(perms, 'MANAGE_SETTINGS')) {
    return '/app/operacional/sofia-config';
  }
  if (can(perms, 'VIEW_RELATORIOS')) {
    return '/app/operacional/relatorios';
  }

  if (hasAnyPortalRoute(perms)) {
    return '/inicio';
  }

  if (can(perms, 'workspace.app.view')) {
    return '/inicio';
  }

  return '/inicio';
}
