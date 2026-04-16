import { isAdminSuperRole } from '@/lib/adminSuperRoles';

/**
 * Destino padrão após login (fase_1.md — colaborador vs operacional vs admin).
 */
export function getDefaultPostLoginPath(permissions: string[] | null | undefined, role: string | null | undefined): string {
  const perms = (permissions || []).map((p) => String(p).trim()).filter(Boolean);

  if (perms.includes('*') || perms.includes('admin.*') || isAdminSuperRole(role)) {
    return '/app/operacional/visao-geral';
  }

  const hasWorkspaceShortcut = perms.includes('workspace.app.view');
  const hasOperationalLegacy = perms.some((p) => /^VIEW_/i.test(p) || p.startsWith('module.'));
  if (hasWorkspaceShortcut || hasOperationalLegacy) {
    return '/app/operacional/visao-geral';
  }

  return '/inicio';
}
