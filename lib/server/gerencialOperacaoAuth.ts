import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "@/lib/server/authorization";
import { GERENCIAL_BI_TAB } from "@/modules/gerencial/permissions";

export type GerencialOperacaoDataTab = "fluxo" | "taxas";

const TAB_PERM: Record<GerencialOperacaoDataTab, (typeof GERENCIAL_BI_TAB)[keyof typeof GERENCIAL_BI_TAB]> = {
  fluxo: GERENCIAL_BI_TAB.fluxoMonitor,
  taxas: GERENCIAL_BI_TAB.taxasGerencial,
};

export function canAccessGerencialOperacaoDataTab(
  session: SessionContext | null,
  tab: GerencialOperacaoDataTab,
): boolean {
  if (!session) return false;
  const tabKey = TAB_PERM[tab];
  return can(session, GERENCIAL_BI_TAB.setorOperacao) && can(session, tabKey);
}

export async function requireGerencialOperacaoDataTab(
  req: Request,
  tab: GerencialOperacaoDataTab,
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (session.mustChangePassword) {
    return { session, denied: NextResponse.json({ error: "Troca de senha obrigatória antes de continuar." }, { status: 428 }) };
  }
  if (!canAccessGerencialOperacaoDataTab(session, tab)) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}
