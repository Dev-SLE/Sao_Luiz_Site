import type { SessionContext } from "./authorization";
import { can } from "./authorization";

export const OPERACIONAL_CTES_VIEW_TAB: Record<string, string> = {
  pendencias: "tab.operacional.pendencias.view",
  criticos: "tab.operacional.criticos.view",
  em_busca: "tab.operacional.em_busca.view",
  ocorrencias: "tab.operacional.ocorrencias.view",
  concluidos: "tab.operacional.concluidos.view",
};

/** Autoriza GET ctes_view / contagens por aba (ocorrências inclui dossiê). */
export function canAccessOperationalCtesView(session: SessionContext, viewKey: string): boolean {
  const tabPerm = OPERACIONAL_CTES_VIEW_TAB[viewKey];
  if (!tabPerm) return true;
  if (can(session, tabPerm)) return true;
  if (viewKey === "ocorrencias" && can(session, "tab.operacional.dossie.view")) return true;
  return false;
}
