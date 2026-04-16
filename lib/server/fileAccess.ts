import type { Pool } from "pg";
import type { SessionContext } from "./authorization";
import { can } from "./authorization";
import { canManagePortalContent } from "./portalContentPermissions";
import type { FileRow } from "@/modules/storage/types";

export async function canSessionAccessFile(pool: Pool, session: SessionContext | null, file: FileRow): Promise<boolean> {
  if (!session) return false;
  if (String(session.role || "").toLowerCase() === "admin") return true;

  const vis = String(file.visibility_scope || "internal").toLowerCase();

  if (file.module === "operacional" && file.entity === "dossier") {
    if (!can(session, "module.operacional.view") || !can(session, "tab.operacional.dossie.view")) return false;
    if (!file.entity_id) return false;
    const d = await pool.query(`SELECT id FROM pendencias.dossiers WHERE id = $1::uuid LIMIT 1`, [file.entity_id]);
    return !!d.rows?.[0];
  }

  if (vis === "portal" || file.module === "portal") {
    return (
      can(session, "portal.home.view") ||
      can(session, "workspace.app.view") ||
      canManagePortalContent(session)
    );
  }

  if (file.module === "financeiro") {
    return can(session, "module.financeiro.view") || can(session, "workspace.app.view");
  }

  return can(session, "workspace.app.view");
}
