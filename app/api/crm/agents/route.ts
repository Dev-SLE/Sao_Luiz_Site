import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const usersRes = await pool.query(
      `
        SELECT username, role
        FROM pendencias.users
        WHERE COALESCE(TRIM(username), '') <> ''
        ORDER BY username ASC
      `
    );
    const workloadsRes = await pool.query(
      `
        SELECT assigned_username, COUNT(*)::int AS active_count
        FROM pendencias.crm_conversations
        WHERE is_active = true AND assigned_username IS NOT NULL
        GROUP BY assigned_username
      `
    );
    const loadMap = new Map<string, number>();
    for (const row of workloadsRes.rows || []) {
      loadMap.set(String(row.assigned_username), Number(row.active_count || 0));
    }

    const agents = (usersRes.rows || []).map((u: any) => ({
      username: String(u.username),
      role: String(u.role || ""),
      activeConversations: loadMap.get(String(u.username)) || 0,
    }));

    const teamsRes = await pool.query(
      `
        SELECT id, name, description, is_active
        FROM pendencias.crm_teams
        ORDER BY name ASC
      `
    );

    return NextResponse.json({
      agents,
      teams: (teamsRes.rows || []).map((t: any) => ({
        id: String(t.id),
        name: String(t.name),
        description: t.description ? String(t.description) : null,
        isActive: !!t.is_active,
      })),
    });
  } catch (error) {
    console.error("CRM agents GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

