import { canEditPortalContent, isSuperRole } from '@/lib/portalEditorAccess';

export type PortalRouteRule =
  | { mode: 'perm'; permission: string }
  | { mode: 'editor' };

/** Mais específico primeiro (prefix match). */
const PORTAL_ROUTE_RULES: { prefix: string; rule: PortalRouteRule }[] = [
  { prefix: '/portal-edicao', rule: { mode: 'editor' } },
  { prefix: '/gestor', rule: { mode: 'perm', permission: 'portal.gestor.view' } },
  { prefix: '/inicio', rule: { mode: 'perm', permission: 'portal.home.view' } },
  { prefix: '/comunicados', rule: { mode: 'perm', permission: 'portal.comunicados.view' } },
  { prefix: '/documentos', rule: { mode: 'perm', permission: 'portal.documentos.view' } },
  { prefix: '/treinamentos', rule: { mode: 'perm', permission: 'portal.treinamentos.view' } },
  { prefix: '/campanhas', rule: { mode: 'perm', permission: 'portal.campanhas.view' } },
  { prefix: '/agenda', rule: { mode: 'perm', permission: 'portal.agenda.view' } },
  { prefix: '/suporte', rule: { mode: 'perm', permission: 'portal.suporte.view' } },
  { prefix: '/solicitacoes', rule: { mode: 'perm', permission: 'portal.solicitacoes.view' } },
  { prefix: '/perfil', rule: { mode: 'perm', permission: 'portal.perfil.view' } },
  { prefix: '/notificacoes', rule: { mode: 'perm', permission: 'portal.home.view' } },
  { prefix: '/meu-ponto', rule: { mode: 'perm', permission: 'portal.meu_ponto.view' } },
  { prefix: '/minha-escala', rule: { mode: 'perm', permission: 'portal.minha_escala.view' } },
  { prefix: '/holerite', rule: { mode: 'perm', permission: 'portal.holerite.view' } },
];

export function matchPortalRouteRule(pathname: string): PortalRouteRule | null {
  const p = (pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  for (const { prefix, rule } of PORTAL_ROUTE_RULES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return rule;
  }
  return null;
}

export function isPortalPathAllowed(
  pathname: string,
  hasPermission: (k: string) => boolean,
  role: string | null | undefined,
  username?: string | null | undefined,
): boolean {
  const rule = matchPortalRouteRule(pathname);
  if (!rule) return false;
  if (isSuperRole(role, username)) return true;
  if (rule.mode === 'editor') return canEditPortalContent(hasPermission, { role, username });
  return hasPermission(rule.permission);
}
