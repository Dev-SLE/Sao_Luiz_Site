import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

const REQUIRED_KANBAN_STAGES = [
  "Aguardando atendimento",
  "Em busca de mercadorias",
  "Aguardando retorno de agência",
  "Ocorrências",
  "Atendimento finalizado",
];

function parseJsonbArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value == null) return [];
  try {
    if (typeof value === "string") {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    }
  } catch {
    // ignore
  }
  return [];
}

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

async function ensureDefaultPipeline(pool: any) {
  const existing = await pool.query(
    "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
  );
  if (existing.rows?.length) return existing.rows[0].id as string;

  // Cria um funil padrão com etapas operacionais
  const pipelineInsert = await pool.query(
    `
      INSERT INTO pendencias.crm_pipelines (name, description, is_default, created_by, created_at, updated_at)
      VALUES ('Funil Padrão', 'Funil criado automaticamente', true, 'system', NOW(), NOW())
      RETURNING id
    `
  );
  const pipelineId = pipelineInsert.rows?.[0]?.id as string;

  const stages = REQUIRED_KANBAN_STAGES;
  for (let i = 0; i < stages.length; i++) {
    await pool.query(
      `
        INSERT INTO pendencias.crm_stages (pipeline_id, name, position, created_at)
        VALUES ($1, $2, $3, NOW())
      `,
      [pipelineId, stages[i], i]
    );
  }

  return pipelineId;
}

async function ensureOperationalStages(pool: any, pipelineId: string) {
  const aliasMap: Record<string, string> = {
    Novos: "Aguardando atendimento",
    Qualificando: "Em busca de mercadorias",
    Negociando: "Aguardando retorno de agência",
    Fechado: "Atendimento finalizado",
  };

  const currentRes = await pool.query(
    `SELECT id, name FROM pendencias.crm_stages WHERE pipeline_id = $1 ORDER BY position ASC, created_at ASC`,
    [pipelineId]
  );
  const current = currentRes.rows || [];

  for (const row of current) {
    const name = String(row.name || "");
    const mapped = aliasMap[name];
    if (!mapped) continue;
    const existsTarget = current.some((x: any) => String(x.name || "") === mapped);
    if (!existsTarget) {
      await pool.query(
        `UPDATE pendencias.crm_stages SET name = $1 WHERE id = $2`,
        [mapped, row.id]
      );
    }
  }

  for (let i = 0; i < REQUIRED_KANBAN_STAGES.length; i++) {
    const stageName = REQUIRED_KANBAN_STAGES[i];
    const stageExists = await pool.query(
      `SELECT id FROM pendencias.crm_stages WHERE pipeline_id = $1 AND name = $2 LIMIT 1`,
      [pipelineId, stageName]
    );
    if (!stageExists.rows?.[0]?.id) {
      await pool.query(
        `INSERT INTO pendencias.crm_stages (pipeline_id, name, position, created_at) VALUES ($1, $2, $3, NOW())`,
        [pipelineId, stageName, i]
      );
    }
  }

  for (let i = 0; i < REQUIRED_KANBAN_STAGES.length; i++) {
    await pool.query(
      `UPDATE pendencias.crm_stages SET position = $3 WHERE pipeline_id = $1 AND name = $2`,
      [pipelineId, REQUIRED_KANBAN_STAGES[i], i]
    );
  }
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const requestUsername = searchParams.get("requestUsername");
    const requestRole = (searchParams.get("requestRole") || "").toLowerCase();
    const mineOnlyRequested = (searchParams.get("mineOnly") || "false").toLowerCase() === "true";
    const teamId = searchParams.get("teamId");

    let scope: "ALL" | "TEAM" | "SELF" = "SELF";
    let teamIds: string[] = [];
    if (requestUsername) {
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
      if (role === "admin" || perms.includes("CRM_SCOPE_ALL")) scope = "ALL";
      else if (perms.includes("CRM_SCOPE_TEAM")) scope = "TEAM";
      else scope = "SELF";

      if (scope === "TEAM") {
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
    }
    const mineOnly = mineOnlyRequested || scope === "SELF";

    const pipelineId = await ensureDefaultPipeline(pool);
    await ensureOperationalStages(pool, pipelineId);

    const pipelineRes = await pool.query(
      "SELECT id, name FROM pendencias.crm_pipelines WHERE id = $1",
      [pipelineId]
    );
    const pipeline = pipelineRes.rows?.[0] || null;

    const stagesRes = await pool.query(
      `
        SELECT id, name, position
        FROM pendencias.crm_stages
        WHERE pipeline_id = $1
        ORDER BY position ASC
      `,
      [pipelineId]
    );
    const stages = (stagesRes.rows || []).map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
      position: Number(r.position || 0),
    }));

    const agenciesRes = await pool.query(
      `
        SELECT
          id, name, city, state, phone, whatsapp, contact_name,
          service_region, avg_response_minutes, internal_rating, notes
        FROM pendencias.crm_agencies
        WHERE is_active = true
        ORDER BY name ASC
        LIMIT 200
      `
    );

    const leadsRes = await pool.query(
      `
      SELECT
        l.id,
        l.title,
        l.contact_phone,
        l.contact_email,
        l.cte_number,
        l.cte_serie,
        l.frete_value,
        l.source,
        l.priority,
        l.current_location,
        l.owner_username,
        l.topic,
        l.assigned_team_id,
        l.assigned_username,
        l.assignment_mode,
        conv_last.conv_assigned_team_id,
        conv_last.conv_assigned_username,
        conv_last.conv_assignment_mode,
        l.protocol_number,
        l.mdfe_date,
        l.route_origin,
        l.route_destination,
        l.requested_at,
        l.service_type,
        l.cargo_status,
        l.customer_status,
        l.agency_id,
        l.agency_requested_at,
        l.agency_sla_minutes,
        l.is_recurring_freight,
        l.tracking_active,
        l.observations,
        ag.name AS agency_name,
        l.stage_id,
        l.position,
        st.name AS stage_name,
        COALESCE(logs_sub.logs, '[]'::jsonb) AS logs
      FROM pendencias.crm_leads l
      JOIN pendencias.crm_stages st ON st.id = l.stage_id
      LEFT JOIN pendencias.crm_agencies ag ON ag.id = l.agency_id
      LEFT JOIN LATERAL (
        SELECT
          c.assigned_username AS conv_assigned_username,
          c.assigned_team_id AS conv_assigned_team_id,
          c.assignment_mode AS conv_assignment_mode
        FROM pendencias.crm_conversations c
        WHERE c.lead_id = l.id
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT 1
      ) conv_last ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(a.description ORDER BY a.created_at DESC) AS logs
        FROM pendencias.crm_activities a
        WHERE a.lead_id = l.id
        LIMIT 15
      ) logs_sub ON true
      WHERE l.pipeline_id = $1
        AND ($2::uuid IS NULL OR l.assigned_team_id = $2::uuid)
        AND (
          $3::boolean = false
          OR $4::text IS NULL
          OR lower(COALESCE(l.assigned_username, l.owner_username, '')) = lower($4::text)
        )
        AND (
          $5::text = 'ALL'
          OR $3::boolean = true
          OR (
            $5::text = 'TEAM'
            AND (
              lower(COALESCE(l.assigned_username, l.owner_username, '')) = lower($4::text)
              OR l.assigned_team_id::text = ANY($6::text[])
            )
          )
          OR ($5::text = 'ALL' AND l.assigned_username IS NULL)
          OR lower(l.assigned_username) = lower(COALESCE($4::text, ''))
          OR lower(l.owner_username) = lower(COALESCE($4::text, ''))
        )
      ORDER BY st.position ASC, l.position ASC
      `,
      [pipelineId, teamId || null, mineOnly, requestUsername || null, scope, teamIds]
    );

    const leads = (leadsRes.rows || []).map((r: any) => ({
      id: r.id as string,
      title: r.title as string,
      phone: r.contact_phone as string | null,
      email: r.contact_email as string | null,
      cte: r.cte_number as string | null,
      freteValue: r.frete_value != null ? Number(r.frete_value) : undefined,
      source: r.source as string,
      priority: r.priority as string,
      currentLocation: r.current_location as string | null,
      ownerUsername: r.owner_username as string | null,
      topic: r.topic as string | null,
      assignedTeamId: (r.assigned_team_id || r.conv_assigned_team_id) as string | null,
      assignedUsername: (r.assigned_username || r.conv_assigned_username) as string | null,
      assignmentMode: (r.assignment_mode || r.conv_assignment_mode) as string | null,
      protocolNumber: r.protocol_number as string | null,
      mdfeDate: r.mdfe_date as string | null,
      routeOrigin: r.route_origin as string | null,
      routeDestination: r.route_destination as string | null,
      requestedAt: r.requested_at as string | null,
      serviceType: r.service_type as string | null,
      cargoStatus: r.cargo_status as string | null,
      customerStatus: r.customer_status as string | null,
      agencyId: r.agency_id as string | null,
      agencyRequestedAt: r.agency_requested_at as string | null,
      agencySlaMinutes: r.agency_sla_minutes != null ? Number(r.agency_sla_minutes) : null,
      isRecurringFreight: !!r.is_recurring_freight,
      trackingActive: !!r.tracking_active,
      observations: r.observations ? String(r.observations) : "",
      agencyName: r.agency_name as string | null,
      stageId: r.stage_id as string,
      logs: parseJsonbArray(r.logs),
    }));

    return NextResponse.json({
      pipeline: pipeline
        ? { id: pipeline.id as string, name: pipeline.name as string }
        : null,
      stages,
      leads,
      agencies: (agenciesRes.rows || []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name || ""),
        city: r.city ? String(r.city) : null,
        state: r.state ? String(r.state) : null,
        phone: r.phone ? String(r.phone) : null,
        whatsapp: r.whatsapp ? String(r.whatsapp) : null,
        contactName: r.contact_name ? String(r.contact_name) : null,
        serviceRegion: r.service_region ? String(r.service_region) : null,
        avgResponseMinutes: r.avg_response_minutes != null ? Number(r.avg_response_minutes) : null,
        internalRating: r.internal_rating != null ? Number(r.internal_rating) : null,
        notes: r.notes ? String(r.notes) : null,
      })),
    });
  } catch (error) {
    console.error("CRM board GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

