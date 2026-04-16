import type { SessionContext } from "@/lib/server/authorization";
import { can } from "@/lib/server/authorization";
import { isAdminSuperRole } from "@/lib/adminSuperRoles";

/** CMS do portal (content_items + uploads) e agenda dinâmica: gestor tradicional ou editor dedicado. */
export function canManagePortalContent(session: SessionContext | null): boolean {
  if (!session) return false;
  if (isAdminSuperRole(session.role)) return true;
  return can(session, "portal.gestor.content.manage") || can(session, "portal.colaborador.editor");
}
