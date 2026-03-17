import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import bcrypt from "../../../bcrypt.js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const currentPassword = String(body?.currentPassword || "").trim();
    const newPassword = String(body?.newPassword || "").trim();
    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "campos obrigatórios" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query("SELECT * FROM pendencias.users WHERE username = $1", [username]);
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });

    const user = result.rows[0];
    const hash = user.password_hash;
    let valid = false;
    if (typeof hash === "string" && hash.startsWith("$2")) valid = await bcrypt.compare(currentPassword, hash);
    else valid = currentPassword === hash;

    if (!valid) return NextResponse.json({ success: false, error: "Senha atual incorreta" }, { status: 401 });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE pendencias.users SET password_hash = $1, updated_at = NOW() WHERE username = $2", [newHash, username]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

