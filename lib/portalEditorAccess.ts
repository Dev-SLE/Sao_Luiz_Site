/** Cliente: quem pode abrir /portal-edicao e usar as mesmas APIs do CMS. */

export type PortalEditorAccessOpts = {
  /** Role vindo da sessão (ex.: users.role). Admin e equivalentes não dependem de portal.colaborador.editor. */
  role?: string | null;
};

function isSuperRole(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "admin" || r === "superadmin" || r === "administrador";
}

/** Quem edita conteúdo do portal (UI + chamadas manage=1). */
export function canEditPortalContent(
  hasPermission: (key: string) => boolean,
  opts?: PortalEditorAccessOpts,
): boolean {
  if (isSuperRole(opts?.role)) return true;
  if (hasPermission("MANAGE_SETTINGS")) return true;
  return hasPermission("portal.gestor.content.manage") || hasPermission("portal.colaborador.editor");
}
