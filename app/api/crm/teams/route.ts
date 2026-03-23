import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const teamsRes = await pool.query(
      `
        SELECT id, name, description, is_active
        FROM pendencias.crm_teams
        ORDER BY name ASC
      `
    );
    const membersRes = await pool.query(
      `
        SELECT id, team_id, username, member_role, is_active
        FROM pendencias.crm_team_members
        ORDER BY username ASC
      `
    );

    const membersByTeam = new Map<string, any[]>();
    for (const m of membersRes.rows || []) {
      const k = String(m.team_id);
      if (!membersByTeam.has(k)) membersByTeam.set(k, []);
      membersByTeam.get(k)!.push({
        id: String(m.id),
        teamId: String(m.team_id),
        username: String(m.username),
        memberRole: String(m.member_role || "ATENDENTE"),
        isActive: !!m.is_active,
      });
    }

    return NextResponse.json({
      teams: (teamsRes.rows || []).map((t: any) => ({
        id: String(t.id),
        name: String(t.name),
        description: t.description ? String(t.description) : null,
        isActive: !!t.is_active,
        members: membersByTeam.get(String(t.id)) || [],
      })),
    });
  } catch (error) {
    console.error("CRM teams GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = body?.action ? String(body.action).toUpperCase() : "UPSERT_TEAM";

    if (action === "UPSERT_TEAM") {
      const id = body?.id ? String(body.id) : null;
      const name = String(body?.name || "").trim();
      const description = body?.description != null ? String(body.description) : null;
      const isActive = body?.isActive === undefined ? true : !!body.isActive;
      if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });

      if (!id) {
        const created = await pool.query(
          `
            INSERT INTO pendencias.crm_teams (name, description, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING id
          `,
          [name, description, isActive]
        );
        return NextResponse.json({ id: created.rows?.[0]?.id, success: true });
      }

      await pool.query(
        `
          UPDATE pendencias.crm_teams
          SET name = $2, description = $3, is_active = $4, updated_at = NOW()
          WHERE id = $1
        `,
        [id, name, description, isActive]
      );
      return NextResponse.json({ id, success: true });
    }

    if (action === "DELETE_TEAM") {
      const id = body?.id ? String(body.id) : null;
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      await pool.query("DELETE FROM pendencias.crm_teams WHERE id = $1", [id]);
      return NextResponse.json({ success: true });
    }

    if (action === "UPSERT_MEMBER") {
      const id = body?.id ? String(body.id) : null;
      const teamId = body?.teamId ? String(body.teamId) : null;
      const username = body?.username ? String(body.username) : null;
      const memberRole = body?.memberRole ? String(body.memberRole).toUpperCase() : "ATENDENTE";
      const isActive = body?.isActive === undefined ? true : !!body.isActive;
      if (!teamId || !username) {
        return NextResponse.json({ error: "teamId e username obrigatórios" }, { status: 400 });
      }

      if (!id) {
        const created = await pool.query(
          `
            INSERT INTO pendencias.crm_team_members (team_id, username, member_role, is_active, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (team_id, username)
            DO UPDATE SET member_role = EXCLUDED.member_role, is_active = EXCLUDED.is_active
            RETURNING id
          `,
          [teamId, username, memberRole, isActive]
        );
        return NextResponse.json({ id: created.rows?.[0]?.id, success: true });
      }

      await pool.query(
        `
          UPDATE pendencias.crm_team_members
          SET team_id = $2, username = $3, member_role = $4, is_active = $5
          WHERE id = $1
        `,
        [id, teamId, username, memberRole, isActive]
      );
      return NextResponse.json({ id, success: true });
    }

    if (action === "DELETE_MEMBER") {
      const id = body?.id ? String(body.id) : null;
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      await pool.query("DELETE FROM pendencias.crm_team_members WHERE id = $1", [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    console.error("CRM teams POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

