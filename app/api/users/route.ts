import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import bcrypt from "../../../bcrypt.js";
import { serverLog } from "../../../lib/server/appLog";
import { requireApiPermissions } from "../../../lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, [
      "MANAGE_USERS",
      "MANAGE_SETTINGS",
      "VIEW_USERS",
      "VIEW_SETTINGS",
      /** Lista de utilizadores para atribuição operacional (sinónimo canónico `operacional.assignment.assign`). */
      "ASSIGN_OPERATIONAL_PENDING",
      "operacional.assignment.assign",
    ]);
    if (guard.denied) return guard.denied;
    const pool = getPool();
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`);
    const result = await pool.query("SELECT * FROM pendencias.users");
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    await serverLog({
      level: "ERROR",
      event: "API_USERS_GET_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_USERS", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "").trim();
    const role = String(body?.role || "").trim();
    const linkedOriginUnit = String(body?.linkedOriginUnit || "").trim();
    const linkedDestUnit = String(body?.linkedDestUnit || "").trim();
    if (!username || !role) {
      return NextResponse.json({ error: "username/role obrigatórios" }, { status: 400 });
    }

    const pool = getPool();
    const existing = await pool.query(
      "SELECT username, password_hash FROM pendencias.users WHERE username = $1 LIMIT 1",
      [username]
    );
    const isUpdate = (existing.rows?.length || 0) > 0;

    if (!isUpdate && !password) {
      return NextResponse.json(
        { error: "password obrigatório para novo usuário" },
        { status: 400 }
      );
    }

    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : String(existing.rows?.[0]?.password_hash || "");

    const result = await pool.query(
      `
        INSERT INTO pendencias.users (username, password_hash, role, linked_origin_unit, linked_dest_unit, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          linked_origin_unit = EXCLUDED.linked_origin_unit,
          linked_dest_unit = EXCLUDED.linked_dest_unit,
          updated_at = NOW()
        RETURNING *
      `,
      [username, passwordHash, role, linkedOriginUnit || null, linkedDestUnit || null]
    );
    return NextResponse.json(result.rows?.[0] || null);
  } catch (error) {
    console.error("Erro ao salvar usuário:", error);
    await serverLog({
      level: "ERROR",
      event: "API_USERS_POST_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_USERS", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    const { searchParams } = new URL(req.url);
    const username = String(searchParams.get("username") || "").trim();
    if (!username) return NextResponse.json({ error: "username obrigatório" }, { status: 400 });
    const pool = getPool();
    await pool.query("DELETE FROM pendencias.users WHERE username = $1", [username]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    await serverLog({
      level: "ERROR",
      event: "API_USERS_DELETE_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

