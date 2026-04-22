import { timingSafeEqual } from "crypto";
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
  const pathname = new URL(req.url).pathname;
  const allowWithoutPasswordChange = new Set<string>([
    "/api/changePassword",
    "/api/auth/session",
    "/api/logout",
  ]);
  if (session.mustChangePassword && !allowWithoutPasswordChange.has(pathname)) {
    return {
      session,
      denied: NextResponse.json(
        { error: "Troca de senha obrigatória antes de continuar." },
        { status: 428 },
      ),
    };
  }
  if (!permissions.length) return { session, denied: null };
  const ok = permissions.some((p) => can(session, p));
  if (!ok) {
    return { session, denied: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, denied: null };
}

/** POST de manutenção (cron): exige CRON_SECRET e header `x-cron-secret` idêntico. */
export function verifyCronSecret(req: Request): boolean {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = String(req.headers.get("x-cron-secret") || "").trim();
  if (!header || header.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(header, "utf8"), Buffer.from(secret, "utf8"));
  } catch {
    return false;
  }
}
