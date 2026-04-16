import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { bumpApiRoute } from "../../../../lib/server/apiHitMeter";
import { readThroughCache } from "../../../../lib/server/readThroughCache";

export const runtime = "nodejs";

function parsePermissions(value: any): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      return value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["tab.crm.chat.view", "module.crm.view"]);
    if (guard.denied) return guard.denied;
    bumpApiRoute("GET /api/crm/agents");
    await ensureCrmSchemaTables();

    const payload = await readThroughCache("crm:agents:get", 45_000, async () => {
    const pool = getPool();

    const usersRes = await pool.query(
      `
        SELECT u.username, u.role, p.permissions
        FROM pendencias.users u
        LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
        WHERE COALESCE(TRIM(u.username), '') <> ''
        ORDER BY u.username ASC
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

    const agents = (usersRes.rows || [])
      .map((u: any) => {
        const role = String(u.role || "");
        const roleLower = role.toLowerCase();
        const perms = parsePermissions(u.permissions);
        const canAttend =
          roleLower === "admin" ||
          perms.includes("VIEW_CRM_CHAT") ||
          perms.includes("CRM_SCOPE_SELF") ||
          perms.includes("CRM_SCOPE_TEAM") ||
          perms.includes("CRM_SCOPE_ALL");
        return {
          username: String(u.username),
          role,
          activeConversations: loadMap.get(String(u.username)) || 0,
          canAttend,
        };
      })
      .filter((a) => a.canAttend);

    const teamsRes = await pool.query(
      `
        SELECT id, name, description, is_active
        FROM pendencias.crm_teams
        ORDER BY name ASC
      `
    );

    return {
      agents,
      teams: (teamsRes.rows || []).map((t: any) => ({
        id: String(t.id),
        name: String(t.name),
        description: t.description ? String(t.description) : null,
        isActive: !!t.is_active,
      })),
    };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("CRM agents GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

