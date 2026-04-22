import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "@/lib/server/authorization";
import { GERENCIAL_BI_TAB } from "@/modules/gerencial/permissions";

/** APIs `/api/bi/desempenho-agencias/*` e `/api/bi/rotas-operacionais/*` (COMERCIAL_DATABASE_URL): hub Gerencial Operação. */
export function canAccessOperacionalDesempenhoAgencias(session: SessionContext | null): boolean {
  if (!session) return false;
  return (
    can(session, GERENCIAL_BI_TAB.setorOperacao) &&
    (can(session, GERENCIAL_BI_TAB.fluxoMonitor) || can(session, GERENCIAL_BI_TAB.taxasGerencial))
  );
}

export async function requireOperacionalDesempenhoAgenciasRead(
  req: Request,
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (session.mustChangePassword) {
    return { session, denied: NextResponse.json({ error: "Troca de senha obrigatória antes de continuar." }, { status: 428 }) };
  }
  if (!canAccessOperacionalDesempenhoAgencias(session)) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}
