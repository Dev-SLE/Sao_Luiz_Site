import { isAdminSuperRole } from "@/lib/adminSuperRoles";

/** Cliente: quem pode abrir /portal-edicao e usar as mesmas APIs do CMS. */

export type PortalEditorAccessOpts = {
  /** Role vindo da sessão (ex.: users.role). Admin e equivalentes não dependem de portal.colaborador.editor. */
  role?: string | null;
  /** Username da sessão — utilizador reservado `sle_master` tem bypass sem depender do perfil. */
  username?: string | null;
};

/** Role de sessão com acesso total ao portal (não depende do array de permissões do perfil). */
export function isSuperRole(role: string | null | undefined, username?: string | null | undefined): boolean {
  return isAdminSuperRole(role, username);
}

/** Quem edita conteúdo do portal (UI + chamadas manage=1). */
export function canEditPortalContent(
  hasPermission: (key: string) => boolean,
  opts?: PortalEditorAccessOpts,
): boolean {
  if (isSuperRole(opts?.role, opts?.username)) return true;
  return hasPermission("portal.gestor.content.manage") || hasPermission("portal.colaborador.editor");
}
