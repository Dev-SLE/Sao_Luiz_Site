import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "@/lib/server/authorization";
import { GERENCIAL_BI_TAB } from "@/modules/gerencial/permissions";
import { BI_COMISSOES_HOLERITE_PERMISSION } from "@/modules/bi/comissoes/config";

export type GerencialCommercialDataTab = "comissoes" | "funil" | "sprint" | "metas";

/** `module.gerencial.view` OU (setor Comercial + aba específica). */
export function canAccessGerencialCommercialDataTab(session: SessionContext | null, tab: GerencialCommercialDataTab): boolean {
  if (!session) return false;
  if (can(session, "module.gerencial.view")) return true;
  const tabKey = GERENCIAL_BI_TAB[tab];
  return can(session, GERENCIAL_BI_TAB.setorComercial) && can(session, tabKey);
}

/** Holerite: permissão dedicada, módulo inteiro, ou comissões (setor + aba). */
export function canAccessComissoesHolerite(session: SessionContext | null): boolean {
  if (!session) return false;
  if (can(session, "module.gerencial.view")) return true;
  if (can(session, BI_COMISSOES_HOLERITE_PERMISSION)) return true;
  return can(session, GERENCIAL_BI_TAB.setorComercial) && can(session, GERENCIAL_BI_TAB.comissoes);
}

export async function requireGerencialCommercialDataTab(
  req: Request,
  tab: GerencialCommercialDataTab,
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!canAccessGerencialCommercialDataTab(session, tab)) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}

export async function requireGerencialComissoesHolerite(
  req: Request,
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!canAccessComissoesHolerite(session)) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}
