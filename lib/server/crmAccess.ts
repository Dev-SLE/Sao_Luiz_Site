import { isAdminSuperRole } from "../adminSuperRoles";
import { getPool } from "./db";
import type { SessionContext } from "./authorization";

export type CrmScopeLevel = "ALL" | "TEAM" | "SELF";

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

/** Últimos 10 dígitos para match de telefone (Brasil / international). */
export function normalizePhoneLast10(raw: string | null | undefined): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length <= 10 ? digits : digits.slice(-10);
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim().toLowerCase();
  return s || null;
}

export async function resolveCrmListScope(session: SessionContext): Promise<{
  scope: CrmScopeLevel;
  teamIds: string[];
  username: string;
  mineOnly: boolean;
}> {
  const pool = getPool();
  const requestUsername = session.username;
  const requestRole = (session.role || "").toLowerCase();

  let scope: CrmScopeLevel = "SELF";
  const ures = await pool.query(
    `
      SELECT u.role, p.permissions
      FROM pendencias.users u
      LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1
    `,
    [requestUsername]
  );
  const row = ures.rows?.[0];
  const role = String(row?.role || requestRole || "").toLowerCase();
  const perms = parsePermissions(row?.permissions);
  if (
    isAdminSuperRole(role, requestUsername) ||
    perms.includes("CRM_SCOPE_ALL") ||
    perms.includes("scope.crm.all")
  ) {
    scope = "ALL";
  }
  else if (perms.includes("CRM_SCOPE_TEAM") || perms.includes("scope.crm.team")) scope = "TEAM";

  const mineOnly = scope === "SELF";
  let teamIds: string[] = [];
  if (scope === "TEAM" && requestUsername) {
    const teamRes = await pool.query(
      `
        SELECT team_id::text AS team_id
        FROM pendencias.crm_team_members
        WHERE LOWER(username) = LOWER($1) AND is_active = true
      `,
      [requestUsername]
    );
    teamIds = (teamRes.rows || []).map((r: any) => String(r.team_id));
  }

  return {
    scope,
    teamIds,
    username: requestUsername,
    mineOnly,
  };
}

/** Leads com pelo menos uma conversa visível ao escopo do usuário (mesma regra da listagem de conversas). */
export async function filterLeadIdsVisibleInCrm(
  pool: any,
  leadIds: string[],
  ctx: { scope: CrmScopeLevel; teamIds: string[]; username: string; mineOnly: boolean },
  filterTeamId: string | null
): Promise<string[]> {
  if (!leadIds.length) return [];
  const res = await pool.query(
    `
      SELECT DISTINCT l.id::text AS id
      FROM pendencias.crm_leads l
      INNER JOIN pendencias.crm_conversations c ON c.lead_id = l.id
      WHERE l.id = ANY($1::uuid[])
        AND ($2::uuid IS NULL OR c.assigned_team_id = $2::uuid)
        AND (
          $3::boolean = false
          OR $4::text IS NULL
          OR c.assigned_username = $4::text
        )
        AND (
          $5::text = 'ALL'
          OR $3::boolean = true
          OR (
            $5::text = 'TEAM'
            AND (
              c.assigned_username = $4::text
              OR c.assigned_team_id::text = ANY($6::text[])
            )
          )
          OR ($5::text = 'ALL' AND c.assigned_username IS NULL)
          OR c.assigned_username = $4::text
        )
    `,
    [leadIds, filterTeamId, ctx.mineOnly, ctx.username || null, ctx.scope, ctx.teamIds]
  );
  const fromConversations = (res.rows || []).map((r: any) => String(r.id));

  if (ctx.scope === "ALL") {
    const extra = await pool.query(
      `
        SELECT l.id::text AS id
        FROM pendencias.crm_leads l
        WHERE l.id = ANY($1::uuid[])
          AND (
            LOWER(TRIM(COALESCE(l.assigned_username,''))) = LOWER(TRIM(COALESCE($2::text,'')))
            OR LOWER(TRIM(COALESCE(l.owner_username,''))) = LOWER(TRIM(COALESCE($2::text,'')))
          )
      `,
      [leadIds, ctx.username]
    );
    const set = new Set<string>(fromConversations);
    for (const r of extra.rows || []) set.add(String(r.id));
    return Array.from(set);
  }

  const extraSelf = await pool.query(
    `
      SELECT l.id::text AS id
      FROM pendencias.crm_leads l
      WHERE l.id = ANY($1::uuid[])
        AND (
          LOWER(TRIM(COALESCE(l.assigned_username,''))) = LOWER(TRIM(COALESCE($2::text,'')))
          OR LOWER(TRIM(COALESCE(l.owner_username,''))) = LOWER(TRIM(COALESCE($2::text,'')))
        )
    `,
    [leadIds, ctx.username]
  );
  const set = new Set<string>(fromConversations);
  for (const r of extraSelf.rows || []) set.add(String(r.id));
  return Array.from(set);
}

/** Verifica se o usuário enxerga o lead (conversa no escopo ou atribuição do lead). */
export async function sessionCanAccessLead(
  pool: any,
  session: SessionContext,
  leadId: string
): Promise<boolean> {
  const ctx = await resolveCrmListScope(session);
  const visible = await filterLeadIdsVisibleInCrm(pool, [leadId], ctx, null);
  return visible.includes(leadId);
}
