import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { serverLog } from "../../../lib/server/appLog";
import { requireApiPermissions } from "../../../lib/server/apiAuth";
import { stripOperacionalPermissionsWithoutModule } from "../../../lib/workspacePermissionNormalize";
import { maybeBackfillFinanceiroModulePermission } from "../../../lib/server/profileFinanceiroPermissionBackfill";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // Necessário para o cliente resolver permissões por perfil após login.
    const guard = await requireApiPermissions(req, []);
    if (guard.denied) return guard.denied;
    const pool = getPool();
    await maybeBackfillFinanceiroModulePermission(pool);
    const result = await pool.query("SELECT * FROM pendencias.profiles ORDER BY name ASC");
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error("Erro ao buscar perfis:", error);
    await serverLog({
      level: "ERROR",
      event: "API_PROFILES_GET_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    let permissions = Array.isArray(body?.permissions) ? body.permissions.map(String) : [];
    permissions = stripOperacionalPermissionsWithoutModule(permissions);
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
    await serverLog({
      level: "ERROR",
      event: "API_PROFILES_POST_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    const { searchParams } = new URL(req.url);
    const name = String(searchParams.get("name") || "").trim();
    if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
    const pool = getPool();
    await pool.query("DELETE FROM pendencias.profiles WHERE name = $1", [name]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar perfil:", error);
    await serverLog({
      level: "ERROR",
      event: "API_PROFILES_DELETE_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

