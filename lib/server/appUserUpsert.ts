import type { Pool, PoolClient } from "pg";
import bcrypt from "../../bcrypt.js";
import { validateStrongPassword } from "./passwordPolicy";

export type AppUserUpsertBody = {
  username: string;
  password?: string;
  role: string;
  linkedOriginUnit?: string;
  linkedDestUnit?: string;
  linkedBiVendedora?: string;
};

export type AppUserUpsertResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/**
 * Mesma regra que `POST /api/users`: cria ou atualiza utilizador na app.
 */
export async function upsertAppUser(pool: Pool | PoolClient, body: AppUserUpsertBody): Promise<AppUserUpsertResult> {
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "").trim();
  const role = String(body?.role || "").trim();
  const linkedOriginUnit = String(body?.linkedOriginUnit || "").trim();
  const linkedDestUnit = String(body?.linkedDestUnit || "").trim();
  const linkedBiVendedora = String(body?.linkedBiVendedora ?? "").trim();

  if (!username || !role) {
    return { ok: false, status: 400, error: "username/role obrigatórios" };
  }

  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS linked_bi_vendedora text`);
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true`);
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 1`);
  await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`);

  const existing = await pool.query(
    "SELECT username, password_hash FROM pendencias.users WHERE username = $1 LIMIT 1",
    [username],
  );
  const isUpdate = (existing.rows?.length || 0) > 0;

  if (!isUpdate && !password) {
    return { ok: false, status: 400, error: "password obrigatório para novo usuário" };
  }
  if (password) {
    const policy = validateStrongPassword(password, username);
    if (!policy.ok) {
      return { ok: false, status: 400, error: policy.errors.join(" ") };
    }
  }

  const passwordHash = password
    ? await bcrypt.hash(password, 10)
    : String(existing.rows?.[0]?.password_hash || "");
  const mustChangePassword = !isUpdate || Boolean(password);

  const result = await pool.query(
    `
      INSERT INTO pendencias.users (username, password_hash, role, linked_origin_unit, linked_dest_unit, linked_bi_vendedora, must_change_password, session_version, password_changed_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CASE WHEN $8::boolean THEN NOW() ELSE NULL END, NOW())
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        linked_origin_unit = EXCLUDED.linked_origin_unit,
        linked_dest_unit = EXCLUDED.linked_dest_unit,
        linked_bi_vendedora = EXCLUDED.linked_bi_vendedora,
        must_change_password = EXCLUDED.must_change_password,
        session_version = CASE WHEN $8::boolean THEN COALESCE(pendencias.users.session_version,1) + 1 ELSE COALESCE(pendencias.users.session_version,1) END,
        password_changed_at = CASE WHEN $8::boolean THEN NOW() ELSE pendencias.users.password_changed_at END,
        updated_at = NOW()
      RETURNING username, role, linked_origin_unit, linked_dest_unit, linked_bi_vendedora, last_login_at, must_change_password
    `,
    [
      username,
      passwordHash,
      role,
      linkedOriginUnit || null,
      linkedDestUnit || null,
      linkedBiVendedora || null,
      mustChangePassword,
      Boolean(password),
    ],
  );

  return { ok: true, row: (result.rows?.[0] || {}) as Record<string, unknown> };
}
