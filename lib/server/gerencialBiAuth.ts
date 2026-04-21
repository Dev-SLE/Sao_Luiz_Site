import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "@/lib/server/authorization";
import { GERENCIAL_BI_TAB } from "@/modules/gerencial/permissions";
import { BI_COMISSOES_HOLERITE_PERMISSION } from "@/modules/bi/comissoes/config";

export type GerencialCommercialDataTab =
  | "comissoes"
  | "funil"
  | "sprint"
  | "metas"
  | "carteira"
  | "360cockpit"
  | "360executiva"
  | "360risco"
  | "360gap"
  | "360radar";

const COMMERCIAL_TAB_PERM: Record<GerencialCommercialDataTab, (typeof GERENCIAL_BI_TAB)[keyof typeof GERENCIAL_BI_TAB]> = {
  comissoes: GERENCIAL_BI_TAB.comissoes,
  funil: GERENCIAL_BI_TAB.funil,
  sprint: GERENCIAL_BI_TAB.sprint,
  metas: GERENCIAL_BI_TAB.metas,
  carteira: GERENCIAL_BI_TAB.carteiraRenovacao,
  "360cockpit": GERENCIAL_BI_TAB.comercial360Cockpit,
  "360executiva": GERENCIAL_BI_TAB.comercial360Executiva,
  "360risco": GERENCIAL_BI_TAB.comercial360Risco,
  "360gap": GERENCIAL_BI_TAB.comercial360Gap,
  "360radar": GERENCIAL_BI_TAB.comercial360Radar,
};

const COMERCIAL_360_TABS: GerencialCommercialDataTab[] = ["360cockpit", "360executiva", "360risco", "360gap", "360radar"];

/** Leitura das APIs `/api/bi/comercial-360/*`: módulo gerencial, setor comercial e pelo menos uma aba 360. */
export function canAccessComercial360Dataset(session: SessionContext | null): boolean {
  if (!session) return false;
  if (can(session, "module.gerencial.view")) return true;
  if (!can(session, GERENCIAL_BI_TAB.setorComercial)) return false;
  return COMERCIAL_360_TABS.some((t) => can(session, COMMERCIAL_TAB_PERM[t]));
}

export async function requireComercial360Read(
  req: Request,
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!canAccessComercial360Dataset(session)) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}

/** `module.gerencial.view` OU (setor Comercial + aba específica). */
export function canAccessGerencialCommercialDataTab(session: SessionContext | null, tab: GerencialCommercialDataTab): boolean {
  if (!session) return false;
  if (can(session, "module.gerencial.view")) return true;
  const tabKey = COMMERCIAL_TAB_PERM[tab];
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
