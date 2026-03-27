import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { classifyLeadTopic, pickAgentFromTeam, pickFallbackAgent, resolveRoutingByRules, resolveSlaMinutes } from "../../../../lib/server/crmRouting";

export const runtime = "nodejs";

function formatLastAt(d: Date | null | undefined) {
  if (!d) return "--";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

function parsePermissions(value: any): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      return value.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    const requestUsername = searchParams.get("requestUsername");
    const requestRole = (searchParams.get("requestRole") || "").toLowerCase();
    const mineOnlyRequested = (searchParams.get("mineOnly") || "false").toLowerCase() === "true";
    const teamId = searchParams.get("teamId");

    // Auto-libera locks expirados para evitar conversas "presas".
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
        WHERE lock_expires_at IS NOT NULL AND lock_expires_at < NOW()
      `
    );

    let scope: "ALL" | "TEAM" | "SELF" = "SELF";
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
    }

    const mineOnly = mineOnlyRequested || scope === "SELF";
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

    const result = await pool.query(
      `
        SELECT
          c.id,
          c.channel,
          c.whatsapp_inbox_id,
          wi.name AS inbox_name,
          wi.provider AS inbox_provider,
          c.status,
          c.assigned_team_id,
          c.assigned_username,
          c.assignment_mode,
          c.locked_by,
          c.locked_at,
          c.lock_expires_at,
          c.topic,
          c.routing_source,
          c.sla_due_at,
          c.sla_breached_at,
          c.last_message_at,
          l.id AS lead_id,
          l.title AS lead_name,
          l.contact_phone,
          l.contact_email,
          l.cte_number,
          l.cte_serie,
          l.priority,
          COALESCE(
            lm.body,
            CONCAT(
              'CTE ',
              COALESCE(l.cte_number, '—'),
              ' • ',
              COALESCE(l.contact_phone, l.contact_email, 'Sem contato')
            )
          ) AS last_message_body,
          lm.created_at AS last_message_at
        FROM pendencias.crm_conversations c
        JOIN pendencias.crm_leads l ON l.id = c.lead_id
        LEFT JOIN pendencias.crm_whatsapp_inboxes wi ON wi.id = c.whatsapp_inbox_id
        LEFT JOIN LATERAL (
          SELECT m.body, m.created_at
          FROM pendencias.crm_messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) lm ON true
        WHERE ($1::uuid IS NULL OR c.lead_id = $1)
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
                OR (c.assigned_team_id IS NULL AND c.assigned_username IS NULL)
              )
            )
            OR c.assigned_username IS NULL
            OR c.assigned_username = $4::text
          )
        ORDER BY
          CASE
            WHEN c.status = 'PENDENTE' THEN 0
            WHEN c.status = 'EM_RASTREIO' THEN 1
            WHEN c.status = 'CONCLUIDO' THEN 2
            WHEN c.status = 'PERDIDO' THEN 3
            ELSE 4
          END ASC,
          CASE
            WHEN l.priority = 'ALTA' THEN 0
            WHEN l.priority = 'MEDIA' THEN 1
            ELSE 2
          END ASC,
          COALESCE(lm.created_at, c.last_message_at) DESC NULLS LAST
        LIMIT 50
      `,
      [leadId || null, teamId || null, mineOnly, requestUsername || null, scope, teamIds]
    );

    const conversations = (result.rows || []).map((r: any) => {
      const channel = String(r.channel || "WHATSAPP");
      const priority = String(r.priority || "MEDIA");
      const lastAt = formatLastAt(r.last_message_at ? new Date(r.last_message_at) : null);
      return {
        id: r.id as string,
        channel: channel as any,
        priority: priority as any,
        status: String(r.status || "PENDENTE"),
        assignedTeamId: r.assigned_team_id as string | null,
        assignedUsername: r.assigned_username as string | null,
        assignmentMode: String(r.assignment_mode || "AUTO"),
        lockedBy: r.locked_by as string | null,
        lockedAt: r.locked_at as string | null,
        lockExpiresAt: r.lock_expires_at as string | null,
        topic: r.topic as string | null,
        routingSource: r.routing_source as string | null,
        slaDueAt: r.sla_due_at as string | null,
        slaBreachedAt: r.sla_breached_at as string | null,
        leadId: r.lead_id as string,
        leadName: r.lead_name as string,
        leadPhone: r.contact_phone as string | null,
        leadEmail: r.contact_email as string | null,
        cte: r.cte_number as string | null,
        cteSerie: r.cte_serie as string | null,
        lastMessage: r.last_message_body ? String(r.last_message_body) : "Sem mensagens ainda.",
        lastAt,
        unread: 0,
        whatsappInboxId: r.whatsapp_inbox_id as string | null,
        inboxName: r.inbox_name ? String(r.inbox_name) : null,
        inboxProvider: r.inbox_provider ? String(r.inbox_provider) : null,
      };
    });

    return NextResponse.json({ conversations, scope });
  } catch (error) {
    console.error("CRM conversations GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId ? String(body.leadId) : null;
    const channel = body?.channel ? String(body.channel).toUpperCase() : "WHATSAPP";
    const status = body?.status ? String(body.status).toUpperCase() : "PENDENTE";
    const lockBy = body?.lockedBy ? String(body.lockedBy) : null;
    const lockMinutes = Number(body?.lockMinutes || 15);

    if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });

    if (!["WHATSAPP", "IA", "INTERNO"].includes(channel)) {
      return NextResponse.json({ error: "channel inválido" }, { status: 400 });
    }

    const existing = await pool.query(
      `
        SELECT id
        FROM pendencias.crm_conversations
        WHERE lead_id = $1 AND channel = $2 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [leadId, channel]
    );

    if (existing.rows?.[0]?.id) {
      return NextResponse.json({ conversationId: existing.rows[0].id });
    }

    const leadRes = await pool.query(
      "SELECT id, title, cte_number FROM pendencias.crm_leads WHERE id = $1 LIMIT 1",
      [leadId]
    );
    const lead = leadRes.rows?.[0];
    const routing = await resolveRoutingByRules({
      text: body?.firstMessage ? String(body.firstMessage) : null,
      title: lead?.title ? String(lead.title) : null,
      cte: lead?.cte_number ? String(lead.cte_number) : null,
      leadId,
    });
    const fallbackAgent = await pickFallbackAgent(leadId);
    const assignedUsernameFromTeam =
      routing.targetType === "TEAM" && routing.targetTeamId
        ? await pickAgentFromTeam(routing.targetTeamId, leadId)
        : null;
    const assignedUsername =
      routing.targetType === "USER"
        ? routing.targetUsername
        : (assignedUsernameFromTeam || fallbackAgent);
    const assignedTeamId = routing.targetType === "TEAM" ? routing.targetTeamId : null;
    const topic = (routing.topic || classifyLeadTopic({ title: lead?.title, cte: lead?.cte_number })).toUpperCase();
    const routingSource = routing.source || "TOPIC_ONLY";
    const leadPriority = "MEDIA";
    const slaMinutes = await resolveSlaMinutes({
      teamId: assignedTeamId,
      topic,
      channel,
      priority: leadPriority,
    });

    const created = await pool.query(
      `
        INSERT INTO pendencias.crm_conversations (
          lead_id, channel, is_active, created_at, last_message_at,
          status, assigned_team_id, assigned_username, assignment_mode,
          locked_by, locked_at, lock_expires_at, topic, routing_source
        )
        VALUES (
          $1, $2, true, NOW(), NULL,
          $3, $4, $5, $6,
          $7, CASE WHEN $7 IS NULL THEN NULL ELSE NOW() END,
          CASE WHEN $7 IS NULL THEN NULL ELSE NOW() + ($8::int * INTERVAL '1 minute') END,
          $9, $10
        )
        RETURNING id
      `,
      [
        leadId,
        channel,
        status,
        assignedTeamId,
        assignedUsername,
        body?.assignmentMode ? String(body.assignmentMode).toUpperCase() : "AUTO",
        lockBy,
        lockMinutes,
        topic,
        routingSource,
      ]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET sla_minutes = $2, sla_due_at = NOW() + ($2::int * INTERVAL '1 minute')
        WHERE id = $1
      `,
      [created.rows?.[0]?.id, slaMinutes]
    );

    return NextResponse.json({ conversationId: created.rows?.[0]?.id });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const conversationId = body?.conversationId ? String(body.conversationId) : null;
    if (!conversationId) return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });

    const status = body?.status != null ? String(body.status).toUpperCase() : null;
    const assignInBody = Object.prototype.hasOwnProperty.call(body || {}, "assignedUsername");
    const assignRaw = assignInBody ? body?.assignedUsername : undefined;
    const assignedTeamId =
      body?.assignedTeamId !== undefined
        ? (body.assignedTeamId ? String(body.assignedTeamId) : null)
        : undefined;
    const assignmentMode = body?.assignmentMode != null ? String(body.assignmentMode).toUpperCase() : null;
    const lockAction = body?.lockAction ? String(body.lockAction).toUpperCase() : null; // LOCK | UNLOCK | CLAIM
    const lockBy = body?.lockBy ? String(body.lockBy) : null;
    const lockMinutes = Number(body?.lockMinutes || 15);
    const topic = body?.topic != null ? String(body.topic).toUpperCase() : null;

    const currentRes = await pool.query(
      "SELECT id, lead_id, assigned_username FROM pendencias.crm_conversations WHERE id = $1 LIMIT 1",
      [conversationId]
    );
    const current = currentRes.rows?.[0];
    if (!current) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });

    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET
          status = COALESCE($2, status),
          assigned_username = CASE
            WHEN NOT $9::boolean THEN assigned_username
            WHEN $10::text IS NULL OR TRIM(BOTH FROM COALESCE($10::text, '')) = '' THEN NULL
            ELSE TRIM(BOTH FROM $10::text)
          END,
          assigned_team_id = CASE WHEN $3::text IS NULL THEN assigned_team_id ELSE $3::uuid END,
          assignment_mode = COALESCE($4, assignment_mode),
          topic = COALESCE($5, topic),
          locked_by = CASE
            WHEN $6 = 'UNLOCK' THEN NULL
            WHEN $6 IN ('LOCK', 'CLAIM') THEN $7
            ELSE locked_by
          END,
          locked_at = CASE
            WHEN $6 = 'UNLOCK' THEN NULL
            WHEN $6 IN ('LOCK', 'CLAIM') THEN NOW()
            ELSE locked_at
          END,
          lock_expires_at = CASE
            WHEN $6 = 'UNLOCK' THEN NULL
            WHEN $6 IN ('LOCK', 'CLAIM') THEN NOW() + ($8::int * INTERVAL '1 minute')
            ELSE lock_expires_at
          END,
          sla_breached_at = CASE
            WHEN status IN ('CONCLUIDO', 'PERDIDO') THEN NULL
            WHEN sla_due_at IS NOT NULL AND NOW() > sla_due_at THEN COALESCE(sla_breached_at, NOW())
            ELSE sla_breached_at
          END
        WHERE id = $1
      `,
      [
        conversationId,
        status,
        assignedTeamId ?? null,
        assignmentMode,
        topic,
        lockAction,
        lockBy,
        lockMinutes,
        assignInBody,
        assignRaw === null || assignRaw === undefined ? null : String(assignRaw),
      ]
    );

    if (assignInBody) {
      const newAssign =
        assignRaw === null || assignRaw === undefined || String(assignRaw).trim() === ""
          ? null
          : String(assignRaw).trim();
      await pool.query(
        `
          UPDATE pendencias.crm_leads
          SET
            assigned_username = $1,
            owner_username = $1,
            updated_at = NOW()
          WHERE id = $2::uuid
        `,
        [newAssign, current.lead_id]
      );
    }

    await pool.query(
      `
        INSERT INTO pendencias.crm_assignment_events (
          conversation_id, lead_id, event_type, from_username, to_username, team_id, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      `,
      [
        conversationId,
        current.lead_id,
        lockAction ? `LOCK_${lockAction}` : "ASSIGNMENT_UPDATE",
        current.assigned_username || null,
        assignInBody
          ? assignRaw === null || assignRaw === undefined || String(assignRaw).trim() === ""
            ? null
            : String(assignRaw).trim()
          : current.assigned_username || null,
        assignedTeamId ?? null,
        JSON.stringify({
          status,
          assignmentMode,
          topic,
          lockBy,
          lockMinutes,
        }),
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM conversations PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

