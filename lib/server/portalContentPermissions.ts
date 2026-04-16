import type { SessionContext } from "@/lib/server/authorization";
import { can } from "@/lib/server/authorization";

/** CMS do portal (content_items + uploads) e agenda dinâmica: gestor tradicional ou editor dedicado. */
export function canManagePortalContent(session: SessionContext | null): boolean {
  if (!session) return false;
  const r = String(session.role || "").trim().toLowerCase();
  if (r === "admin" || r === "superadmin" || r === "administrador") return true;
  if (can(session, "MANAGE_SETTINGS")) return true;
  return can(session, "portal.gestor.content.manage") || can(session, "portal.colaborador.editor");
}
