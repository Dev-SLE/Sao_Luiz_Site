import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "@/lib/server/authorization";
import { isAdminSuperRole } from "@/lib/adminSuperRoles";
import { GERENCIAL_BI_TAB } from "@/modules/gerencial/permissions";

/** Painéis financeiros no hub Gerencial: `module.financeiro.view` ou compat `tab.gerencial.setor.financeiro.view`. */
function canReadFinanceiroBi(session: SessionContext): boolean {
  return can(session, GERENCIAL_BI_TAB.setorFinanceiro) || can(session, "module.financeiro.view");
}

/** Leitura das APIs `/api/bi/financeiro/*` (schema `bi`, pool comercial). */
export async function requireFinanceiroBiRead(
  req: Request,
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (
    session.mustChangePassword &&
    !isAdminSuperRole(session.role, session.username)
  ) {
    return {
      session,
      denied: NextResponse.json(
        { error: "Troca de senha obrigatória antes de continuar." },
        { status: 428 },
      ),
    };
  }
  if (!canReadFinanceiroBi(session)) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}
