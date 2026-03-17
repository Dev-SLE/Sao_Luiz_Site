import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT * FROM pendencias.profiles ORDER BY name ASC");
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error("Erro ao buscar perfis:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const permissions = Array.isArray(body?.permissions) ? body.permissions.map(String) : [];
    if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
      `
        INSERT INTO pendencias.profiles (name, description, permissions, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          permissions = EXCLUDED.permissions,
          updated_at = NOW()
        RETURNING *
      `,
      [name, description, permissions]
    );
    return NextResponse.json(result.rows?.[0] || null);
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = String(searchParams.get("name") || "").trim();
    if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
    const pool = getPool();
    await pool.query("DELETE FROM pendencias.profiles WHERE name = $1", [name]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar perfil:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

