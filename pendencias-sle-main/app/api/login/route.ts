import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import bcrypt from "../../../bcrypt.js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query("SELECT * FROM pendencias.users WHERE username = $1", [username]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 401 });
    }

    const user = result.rows[0];
    const hash = user.password_hash;
    let valid = false;
    if (typeof hash === "string" && hash.startsWith("$2")) {
      valid = await bcrypt.compare(password, hash);
    } else {
      valid = password === hash;
    }

    if (!valid) {
      return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        role: user.role,
        origin: user.linked_origin_unit,
        dest: user.linked_dest_unit,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

