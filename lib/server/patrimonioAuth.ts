import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "./authorization";
import { ensurePatrimonioSchemaTables } from "./ensurePatrimonioSchema";

export type PatrimonioGuard = { denied: NextResponse | null; session: SessionContext | null };

export async function requirePatrimonioModule(req: Request): Promise<PatrimonioGuard> {
  const session = await getSessionContext(req);
  if (!session || !can(session, "module.patrimonio.view")) {
    return { denied: NextResponse.json({ error: "Não autorizado" }, { status: 403 }), session: null };
  }
  await ensurePatrimonioSchemaTables();
  return { denied: null, session };
}
