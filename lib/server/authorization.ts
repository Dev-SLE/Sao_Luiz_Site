import { decodeSession, parseCookieValue, SESSION_COOKIE_NAME } from "./session";
import { getPool } from "./db";
import { hasPermissionWithAliases } from "../permissions";
import { isAdminSuperRole } from "../adminSuperRoles";
import { normalizeOperacionalPermissionsForSession } from "../workspacePermissionNormalize";

export type SessionContext = {
  username: string;
  role: string;
  origin?: string | null;
  dest?: string | null;
  /** Escopo BI: só dados desta vendedora quando preenchido no cadastro do usuário. */
  biVendedora?: string | null;
  mustChangePassword?: boolean;
  sessionVersion?: number;
  permissions: string[];
};

/** Compara instante da última troca de senha (evita falsos negativos por formato PG vs ISO no cookie). */
function passwordChangedAtEpochSec(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? null : Math.trunc(t / 1000);
  }
  const d = new Date(String(v));
  const t = d.getTime();
  return Number.isNaN(t) ? null : Math.trunc(t / 1000);
}

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
  const sessionCookie = parseCookieValue(rawCookie, SESSION_COOKIE_NAME);
  const session = decodeSession(sessionCookie);
  if (!session) return null;
  const pool = getPool();
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS linked_bi_vendedora text`);
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true`);
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 1`);
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`);
  const p = await pool.query(
    `
      SELECT p.permissions,
             u.linked_origin_unit,
             u.linked_dest_unit,
             u.linked_bi_vendedora,
             u.must_change_password,
             u.session_version,
             u.password_changed_at
      FROM pendencias.users u
      LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
      WHERE LOWER(TRIM(u.username)) = LOWER(TRIM($1::text))
      LIMIT 1
    `,
    [session.username]
  );
  const row = p.rows?.[0] as
    | {
        permissions?: unknown;
        linked_origin_unit?: unknown;
        linked_dest_unit?: unknown;
        linked_bi_vendedora?: unknown;
        must_change_password?: unknown;
        session_version?: unknown;
        password_changed_at?: unknown;
      }
      | undefined;
  if (!row) return null;

  const dbSessionVersion = Number(row?.session_version ?? 1) || 1;
  const tokenSessionVersion = Number(session.sessionVersion ?? 1) || 1;
  if (dbSessionVersion !== tokenSessionVersion) return null;
  const dbPwdSec = passwordChangedAtEpochSec(row?.password_changed_at);
  const tokenPwdSec = session.passwordChangedAt
    ? passwordChangedAtEpochSec(session.passwordChangedAt)
    : null;
  if (dbPwdSec == null && tokenPwdSec == null) {
    /* ok */
  } else if (dbPwdSec == null || tokenPwdSec == null) {
    return null;
  } else if (Math.abs(dbPwdSec - tokenPwdSec) > 2) {
    return null;
  }
  const rawMustChange = Boolean(row?.must_change_password);
  const bypassRestrictions = isAdminSuperRole(String(session.role), String(session.username));
  return {
    username: String(session.username),
    role: String(session.role || ""),
    origin: row?.linked_origin_unit != null ? String(row.linked_origin_unit) : session.origin || null,
    dest: row?.linked_dest_unit != null ? String(row.linked_dest_unit) : session.dest || null,
    biVendedora:
      row?.linked_bi_vendedora != null && String(row.linked_bi_vendedora).trim() !== ""
        ? String(row.linked_bi_vendedora).trim()
        : session.biVendedora != null && String(session.biVendedora).trim() !== ""
          ? String(session.biVendedora).trim()
          : null,
    mustChangePassword: bypassRestrictions ? false : rawMustChange,
    sessionVersion: dbSessionVersion,
    permissions: normalizeOperacionalPermissionsForSession(parsePermissions(row?.permissions)),
  };
}

export function can(ctx: SessionContext | null, permission: string) {
  if (!ctx) return false;
  if (isAdminSuperRole(ctx.role, ctx.username)) return true;
  return hasPermissionWithAliases(ctx.permissions, permission);
}
