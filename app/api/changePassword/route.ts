import { NextResponse } from "next/server";
import { getSessionContext } from "../../../lib/server/authorization";
import { getPool } from "../../../lib/server/db";
import bcrypt from "../../../bcrypt.js";
import { serverLog } from "../../../lib/server/appLog";
import { validateStrongPassword } from "../../../lib/server/passwordPolicy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const username = String(body?.username || "").trim();
    const currentPassword = String(body?.currentPassword || "").trim();
    const newPassword = String(body?.newPassword || "").trim();
    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "campos obrigatórios" }, { status: 400 });
    }

    if (String(session.username).toLowerCase() !== username.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Operação não permitida" }, { status: 403 });
    }

    const pool = getPool();
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 1`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`);
    const result = await pool.query("SELECT * FROM pendencias.users WHERE username = $1", [username]);
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });

    const user = result.rows[0];
    const hash = user.password_hash;
    if (!(typeof hash === "string" && hash.startsWith("$2"))) {
      return NextResponse.json({ success: false, error: "Conta inválida para troca segura. Solicite reset administrativo." }, { status: 401 });
    }
    const valid = await bcrypt.compare(currentPassword, hash);

    if (!valid) return NextResponse.json({ success: false, error: "Senha atual incorreta" }, { status: 401 });
    const policy = validateStrongPassword(newPassword, username);
    if (!policy.ok) {
      return NextResponse.json({ success: false, error: policy.errors.join(" ") }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE pendencias.users SET password_hash = $1, must_change_password = false, session_version = COALESCE(session_version,1) + 1, password_changed_at = NOW(), updated_at = NOW() WHERE username = $2",
      [newHash, username],
    );
    await serverLog({
      level: "INFO",
      event: "API_CHANGE_PASSWORD_SUCCESS",
      username,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    await serverLog({
      level: "ERROR",
      event: "API_CHANGE_PASSWORD_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

