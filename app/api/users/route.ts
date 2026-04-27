import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { serverLog } from "../../../lib/server/appLog";
import { requireApiPermissions } from "../../../lib/server/apiAuth";
import { upsertAppUser } from "../../../lib/server/appUserUpsert";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, [
      "MANAGE_USERS",
      "VIEW_USERS",
      "VIEW_SETTINGS",
      /** Lista de utilizadores para atribuição operacional (sinónimo canónico `operacional.assignment.assign`). */
      "ASSIGN_OPERATIONAL_PENDING",
      "operacional.assignment.assign",
    ]);
    if (guard.denied) return guard.denied;
    const pool = getPool();
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS linked_bi_vendedora text`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 1`);
    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`);
    const result = await pool.query(`
      SELECT
        username,
        role,
        linked_origin_unit,
        linked_dest_unit,
        linked_bi_vendedora,
        last_login_at,
        must_change_password
      FROM pendencias.users
      ORDER BY username ASC
    `);
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
    const guard = await requireApiPermissions(req, ["MANAGE_USERS"]);
    if (guard.denied) return guard.denied;
    const body = await req.json();
    const pool = getPool();
    const out = await upsertAppUser(pool, {
      username: String(body?.username || "").trim(),
      password: String(body?.password || "").trim(),
      role: String(body?.role || "").trim(),
      linkedOriginUnit: String(body?.linkedOriginUnit || "").trim(),
      linkedDestUnit: String(body?.linkedDestUnit || "").trim(),
      linkedBiVendedora: String(body?.linkedBiVendedora ?? body?.linked_bi_vendedora ?? "").trim(),
    });
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: out.status });
    }
    return NextResponse.json(out.row || null);
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
    const guard = await requireApiPermissions(req, ["MANAGE_USERS"]);
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

