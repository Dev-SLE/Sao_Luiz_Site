import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import bcrypt from "../../../../bcrypt.js";
import { serverLog } from "../../../../lib/server/appLog";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { validateStrongPassword } from "../../../../lib/server/passwordPolicy";
import { isAdminSuperRole } from "../../../../lib/adminSuperRoles";

export const runtime = "nodejs";

/**
 * Redefinição de palavra-passe por administrador (MANAGE_USERS).
 * Não altera a sessão do administrador; invalida sessões do alvo (session_version + 1).
 */
export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_USERS"]);
    if (guard.denied) return guard.denied;
    const session = guard.session!;

    const body = await req.json();
    const targetUsernameRaw = String(body?.targetUsername ?? body?.username ?? "").trim();
    const newPassword = String(body?.newPassword ?? "").trim();
    const forceChangeNextLogin = body?.forceChangeNextLogin !== false;

    if (!targetUsernameRaw || !newPassword) {
      return NextResponse.json(
        { error: "targetUsername e newPassword são obrigatórios" },
        { status: 400 },
      );
    }

    const actor = String(session.username || "").trim();
    if (actor.toLowerCase() === targetUsernameRaw.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            'Para alterar a sua própria palavra-passe, use a página "Alterar senha" no portal.',
        },
        { status: 400 },
      );
    }

    const pool = getPool();
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 1`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`);

    const result = await pool.query(
      `SELECT username, role FROM pendencias.users WHERE LOWER(TRIM(username)) = LOWER(TRIM($1::text)) LIMIT 1`,
      [targetUsernameRaw],
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    }

    const row = result.rows[0];
    const canonicalUsername = String(row.username || "").trim();
    const targetRole = String(row.role || "").trim();

    if (isAdminSuperRole(targetRole, canonicalUsername)) {
      return NextResponse.json(
        { error: "Este utilizador não pode ter a palavra-passe redefinida por esta ação." },
        { status: 403 },
      );
    }

    const policy = validateStrongPassword(newPassword, canonicalUsername);
    if (!policy.ok) {
      return NextResponse.json({ error: policy.errors.join(" ") }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE pendencias.users SET
        password_hash = $1,
        must_change_password = $2,
        session_version = COALESCE(session_version,1) + 1,
        password_changed_at = NOW(),
        updated_at = NOW()
      WHERE username = $3`,
      [newHash, forceChangeNextLogin, canonicalUsername],
    );

    await serverLog({
      level: "INFO",
      event: "API_USERS_RESET_PASSWORD",
      username: actor,
      data: { target: canonicalUsername, forceChangeNextLogin },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    await serverLog({
      level: "ERROR",
      event: "API_USERS_RESET_PASSWORD_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
