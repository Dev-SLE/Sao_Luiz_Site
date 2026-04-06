import { NextResponse } from "next/server";
import { can, getSessionContext, type SessionContext } from "./authorization";

type PermissionList = string[];

export async function requireApiPermissions(
  req: Request,
  permissions: PermissionList
): Promise<{ session: SessionContext | null; denied: NextResponse | null }> {
  const session = await getSessionContext(req);
  if (!session) {
    return { session: null, denied: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!permissions.length) return { session, denied: null };
  const ok = permissions.some((p) => can(session, p));
  if (!ok) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}
