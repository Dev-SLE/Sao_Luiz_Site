import { decodeSession, SESSION_COOKIE_NAME } from "./session";
import { getPool } from "./db";
import { hasPermissionWithAliases } from "../permissions";
import { isAdminSuperRole } from "../adminSuperRoles";

export type SessionContext = {
  username: string;
  role: string;
  origin?: string | null;
  dest?: string | null;
  permissions: string[];
};

function parsePermissions(value: any): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      return value.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function getSessionContext(req: Request): Promise<SessionContext | null> {
  const rawCookie = req.headers.get("cookie") || "";
  const sessionCookie = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];
  const session = decodeSession(sessionCookie ? decodeURIComponent(sessionCookie) : null);
  if (!session) return null;
  const pool = getPool();
  const p = await pool.query(
    `
      SELECT p.permissions
      FROM pendencias.users u
      LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1
    `,
    [session.username]
  );
  return {
    username: String(session.username),
    role: String(session.role || ""),
    origin: session.origin || null,
    dest: session.dest || null,
    permissions: parsePermissions(p.rows?.[0]?.permissions),
  };
}

export function can(ctx: SessionContext | null, permission: string) {
  if (!ctx) return false;
  if (isAdminSuperRole(ctx.role)) return true;
  return hasPermissionWithAliases(ctx.permissions, permission);
}
