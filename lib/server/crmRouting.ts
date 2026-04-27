import { getPool } from "./db";

type RuleRow = {
  id: string;
  name: string;
  priority: number;
  match_type: string;
  match_value: string;
  target_type: string;
  target_team_id: string | null;
  target_username: string | null;
  target_stage_id: string | null;
};

export function classifyLeadTopic(input: {
  text?: string | null;
  title?: string | null;
  cte?: string | null;
}) {
  const base = `${input.text || ""} ${input.title || ""} ${input.cte || ""}`.toLowerCase();
  const has = (k: string) => base.includes(k);

  if (has("rastre") || has("entrega") || has("cte") || has("coleta") || has("motorista")) {
    return "RASTREIO";
  }
  if (has("cotação") || has("cotacao") || has("preço") || has("preco") || has("valor")) {
    return "COMERCIAL";
  }
  if (has("reclama") || has("atras") || has("falha") || has("problema")) {
    return "SUPORTE";
  }
  if (has("financeiro") || has("fatura") || has("boleto") || has("pagamento")) {
    return "FINANCEIRO";
  }
  return "GERAL";
}

function norm(v: string | null | undefined) {
  return String(v || "").trim().toLowerCase();
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

function canAttendCrm(role: string, permissions: any): boolean {
  const roleLower = String(role || "").toLowerCase();
  const perms = parsePermissions(permissions);
  return (
    roleLower === "admin" ||
    perms.includes("VIEW_CRM_CHAT") ||
    perms.includes("CRM_SCOPE_SELF") ||
    perms.includes("CRM_SCOPE_TEAM") ||
    perms.includes("CRM_SCOPE_ALL")
  );
}

function hasRecentLogin(lastLoginAt: string | Date | null | undefined, maxOfflineMinutes: number): boolean {
  if (!lastLoginAt) return false;
  const dt = new Date(lastLoginAt);
  if (Number.isNaN(dt.getTime())) return false;
  const diffMs = Date.now() - dt.getTime();
  return diffMs >= 0 && diffMs <= maxOfflineMinutes * 60 * 1000;
}

export async function resolveRoutingByRules(input: {
  text?: string | null;
  title?: string | null;
  cte?: string | null;
  leadId?: string | null;
  /** Tópico já definido por IA (classificação); senão usa heurística. */
  topicOverride?: string | null;
}) {
  const pool = getPool();
  const override = String(input.topicOverride || "").trim().toUpperCase();
  const topic = override || classifyLeadTopic(input);
  const haystack = `${input.text || ""} ${input.title || ""} ${input.cte || ""}`.toLowerCase();

  const rulesRes = await pool.query(
    `
      SELECT
        id, name, priority, match_type, match_value,
        target_type, target_team_id, target_username, target_stage_id
      FROM pendencias.crm_routing_rules
      WHERE is_active = true
      ORDER BY priority ASC, created_at ASC
    `
  );
  const rules = (rulesRes.rows || []) as RuleRow[];

  for (const rule of rules) {
    const matchType = norm(rule.match_type);
    const matchValue = norm(rule.match_value);
    let matched = false;

    if (matchType === "topic" && matchValue && topic.toLowerCase() === matchValue) matched = true;
    if (matchType === "contains" && matchValue && haystack.includes(matchValue)) matched = true;
    if (matchType === "regex" && matchValue) {
      try {
        matched = new RegExp(matchValue, "i").test(haystack);
      } catch {
        matched = false;
      }
    }
    if (!matched) continue;

    return {
      source: "RULE",
      topic,
      ruleId: rule.id,
      ruleName: rule.name,
      targetType: rule.target_type || "NONE",
      targetTeamId: rule.target_team_id || null,
      targetUsername: rule.target_username || null,
      targetStageId: rule.target_stage_id || null,
    };
  }

  return {
    source: "TOPIC_ONLY",
    topic,
    ruleId: null,
    ruleName: null,
    targetType: "NONE",
    targetTeamId: null,
    targetUsername: null,
    targetStageId: null,
  };
}

export async function pickFallbackAgent(conversationId: string) {
  const pool = getPool();
  const usersRes = await pool.query(
    `
      SELECT u.username, u.role, p.permissions
      FROM pendencias.users u
      LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
      WHERE COALESCE(TRIM(username), '') <> ''
    `
  );
  const users = (usersRes.rows || [])
    .map((r: any) => ({
      username: String(r.username),
      role: String(r.role || ""),
      permissions: r.permissions,
    }))
    .filter((u) => canAttendCrm(u.role, u.permissions));

  if (!users.length) return null;

  const loadRes = await pool.query(
    `
      SELECT assigned_username, COUNT(*)::int AS cnt
      FROM pendencias.crm_conversations
      WHERE is_active = true AND assigned_username IS NOT NULL
      GROUP BY assigned_username
    `
  );
  const loadMap = new Map<string, number>();
  for (const row of loadRes.rows || []) {
    loadMap.set(String(row.assigned_username), Number(row.cnt || 0));
  }

  const scored = users
    .map((u) => ({ ...u, load: loadMap.get(u.username) || 0 }))
    .sort((a, b) => a.load - b.load || a.username.localeCompare(b.username));
  const sameLoad = scored.filter((s) => s.load === scored[0].load);
  const group = sameLoad.length ? sameLoad : scored;

  const scopeKey = "GLOBAL";
  const rrRes = await pool.query(
    "SELECT last_index FROM pendencias.crm_rr_state WHERE scope_key = $1 LIMIT 1",
    [scopeKey]
  );
  const lastIndex = Number(rrRes.rows?.[0]?.last_index || 0);
  const nextIndex = (lastIndex + 1) % group.length;
  await pool.query(
    `
      INSERT INTO pendencias.crm_rr_state(scope_key, last_index, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (scope_key) DO UPDATE
      SET last_index = EXCLUDED.last_index, updated_at = NOW()
    `,
    [scopeKey, nextIndex]
  );
  return group[nextIndex]?.username || group[0].username;
}

export async function pickAgentFromTeam(teamId: string, conversationId: string) {
  const pool = getPool();
  const membersRes = await pool.query(
    `
      SELECT tm.username, u.role, p.permissions
      FROM pendencias.crm_team_members tm
      JOIN pendencias.users u ON LOWER(u.username) = LOWER(tm.username)
      LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
      WHERE tm.team_id = $1 AND tm.is_active = true
    `,
    [teamId]
  );
  const members = (membersRes.rows || [])
    .filter((r: any) => canAttendCrm(String(r.role || ""), r.permissions))
    .map((r: any) => String(r.username))
    .filter(Boolean);
  if (!members.length) return null;

  const loadRes = await pool.query(
    `
      SELECT assigned_username, COUNT(*)::int AS cnt
      FROM pendencias.crm_conversations
      WHERE is_active = true AND assigned_username IS NOT NULL AND assigned_team_id = $1
      GROUP BY assigned_username
    `,
    [teamId]
  );
  const loadMap = new Map<string, number>();
  for (const row of loadRes.rows || []) {
    loadMap.set(String(row.assigned_username), Number(row.cnt || 0));
  }
  const scored = members
    .map((username) => ({ username, load: loadMap.get(username) || 0 }))
    .sort((a, b) => a.load - b.load || a.username.localeCompare(b.username));
  const sameLoad = scored.filter((s) => s.load === scored[0].load);
  const group = sameLoad.length ? sameLoad : scored;
  const scopeKey = `TEAM:${teamId}`;
  const rrRes = await pool.query(
    "SELECT last_index FROM pendencias.crm_rr_state WHERE scope_key = $1 LIMIT 1",
    [scopeKey]
  );
  const lastIndex = Number(rrRes.rows?.[0]?.last_index || 0);
  const nextIndex = (lastIndex + 1) % group.length;
  await pool.query(
    `
      INSERT INTO pendencias.crm_rr_state(scope_key, last_index, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (scope_key) DO UPDATE
      SET last_index = EXCLUDED.last_index, updated_at = NOW()
    `,
    [scopeKey, nextIndex]
  );
  return group[nextIndex]?.username || group[0].username;
}

export async function resolveInboxDefaultAssignment(args: {
  inboxId: string;
  conversationId: string;
}) {
  const pool = getPool();
  const inboxRes = await pool.query(
    `
      SELECT id, team_id, owner_username
      FROM pendencias.crm_whatsapp_inboxes
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [args.inboxId]
  );
  const inbox = inboxRes.rows?.[0];
  if (!inbox?.id) return { assignedUsername: null as string | null, assignedTeamId: null as string | null, source: "NONE" as const };
  const teamId = inbox.team_id ? String(inbox.team_id) : null;
  const ownerUsername = inbox.owner_username ? String(inbox.owner_username).trim() : "";

  if (ownerUsername) {
    const ownerRes = await pool.query(
      `
        SELECT u.username, u.role, p.permissions, u.last_login_at
        FROM pendencias.users u
        LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
        WHERE LOWER(u.username) = LOWER($1)
        LIMIT 1
      `,
      [ownerUsername]
    );
    const owner = ownerRes.rows?.[0];
    const ownerCanAttend = !!owner && canAttendCrm(String(owner.role || ""), owner.permissions);
    // Regra operacional atual:
    // conversa nova sempre entra no dono da caixa, sem depender de login recente/rateio.
    if (ownerCanAttend) {
      return {
        assignedUsername: String(owner.username),
        assignedTeamId: teamId,
        source: "OWNER" as const,
      };
    }
  }

  if (teamId) {
    const teamAgent = await pickAgentFromTeam(teamId, args.conversationId);
    if (teamAgent) {
      return {
        assignedUsername: teamAgent,
        assignedTeamId: teamId,
        source: "TEAM_RATEIO" as const,
      };
    }
    return {
      assignedUsername: null,
      assignedTeamId: teamId,
      source: "TEAM_QUEUE" as const,
    };
  }

  return { assignedUsername: null, assignedTeamId: null, source: "NONE" as const };
}

/**
 * Resolve estágio do funil pelo tópico (nome exato + fallback por padrão no nome).
 * Regras de roteamento genéricas não devem impedir RASTREIO/SUPORTE de irem para a coluna operacional correta.
 */
async function resolveTopicStageId(leadId: string, topic: string): Promise<string | null> {
  const pool = getPool();
  const stageNameByTopic: Record<string, string> = {
    RASTREIO: "Em busca de mercadorias",
    SUPORTE: "Ocorrências",
    OCORRENCIA: "Ocorrências",
    COMERCIAL: "Aguardando atendimento",
    COTACAO: "Aguardando atendimento",
    FINANCEIRO: "Aguardando atendimento",
    GERAL: "Aguardando atendimento",
  };
  const stageName = stageNameByTopic[topic] || "Aguardando atendimento";

  const exact = await pool.query(
    `
      SELECT s.id
      FROM pendencias.crm_leads l
      JOIN pendencias.crm_stages s ON s.pipeline_id = l.pipeline_id
      WHERE l.id = $1::uuid AND LOWER(TRIM(s.name)) = LOWER(TRIM($2))
      LIMIT 1
    `,
    [leadId, stageName]
  );
  if (exact.rows?.[0]?.id) return String(exact.rows[0].id);

  let likePattern: string | null = null;
  if (topic === "RASTREIO") likePattern = "%busca%mercador%";
  else if (topic === "SUPORTE" || topic === "OCORRENCIA") likePattern = "%ocorr%";
  else if (topic === "COMERCIAL" || topic === "COTACAO" || topic === "FINANCEIRO" || topic === "GERAL")
    likePattern = "%aguardando%atendimento%";

  if (likePattern) {
    const fuzzy = await pool.query(
      `
        SELECT s.id
        FROM pendencias.crm_leads l
        JOIN pendencias.crm_stages s ON s.pipeline_id = l.pipeline_id
        WHERE l.id = $1::uuid AND LOWER(s.name) LIKE $2
        ORDER BY s.position ASC NULLS LAST, s.created_at ASC
        LIMIT 1
      `,
      [leadId, likePattern]
    );
    if (fuzzy.rows?.[0]?.id) return String(fuzzy.rows[0].id);
  }

  return null;
}

/**
 * Após inbound (ex.: WhatsApp): classifica tópico, aplica regras e atribui estágio/atendente quando configurado.
 */
export async function applyInboundRouting(input: {
  leadId: string;
  conversationId: string;
  text?: string | null;
  title?: string | null;
  cte?: string | null;
  /** Quando definido (ex.: classificação IA), evita sobrescrever o tópico com heurística simples. */
  topicOverride?: string | null;
}) {
  const pool = getPool();
  const convRes = await pool.query(
    `
      SELECT assigned_username, assigned_team_id
      FROM pendencias.crm_conversations
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [input.conversationId]
  );
  const convCurrent = convRes.rows?.[0] || {};
  const hasPreAssignment =
    !!String(convCurrent.assigned_username || "").trim() || !!String(convCurrent.assigned_team_id || "").trim();
  const override = String(input.topicOverride || "").trim().toUpperCase();
  const topic = override || classifyLeadTopic(input);
  const routing = await resolveRoutingByRules({
    text: input.text,
    title: input.title,
    cte: input.cte,
    leadId: input.leadId,
    topicOverride: override || null,
  });

  await pool.query(
    `
      UPDATE pendencias.crm_conversations
      SET topic = $1, routing_source = $2, updated_at = NOW()
      WHERE id = $3::uuid
    `,
    [topic, routing.source === "RULE" ? "RULE" : "TOPIC", input.conversationId]
  );

  const topicStageId = await resolveTopicStageId(input.leadId, topic);
  /** RASTREIO/SUPORTE: coluna operacional tem prioridade sobre regra que mande tudo para "Aguardando". */
  let stageToApply: string | null =
    topic === "RASTREIO" || topic === "SUPORTE" || topic === "OCORRENCIA"
      ? topicStageId || routing.targetStageId || null
      : routing.targetStageId || topicStageId || null;

  if (stageToApply) {
    await moveLeadToStage(input.leadId, stageToApply);
  }

  const tt = String(routing.targetType || "NONE").toUpperCase();
  let assigned = false;

  if (tt === "USER" && routing.targetUsername) {
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET
          assigned_username = COALESCE(assigned_username, $1),
          assigned_team_id = COALESCE(assigned_team_id, $2::uuid),
          updated_at = NOW()
        WHERE id = $3::uuid
      `,
      [routing.targetUsername, routing.targetTeamId, input.conversationId]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_leads
        SET owner_username = COALESCE(owner_username, $1), updated_at = NOW()
        WHERE id = $2::uuid
      `,
      [routing.targetUsername, input.leadId]
    );
    assigned = true;
  } else if (tt === "TEAM" && routing.targetTeamId) {
    const agent = await pickAgentFromTeam(routing.targetTeamId, input.conversationId);
    if (agent) {
      await pool.query(
        `
          UPDATE pendencias.crm_conversations
          SET
            assigned_username = COALESCE(assigned_username, $1),
            assigned_team_id = $2::uuid,
            updated_at = NOW()
          WHERE id = $3::uuid
        `,
        [agent, routing.targetTeamId, input.conversationId]
      );
      await pool.query(
        `
          UPDATE pendencias.crm_leads
          SET owner_username = COALESCE(owner_username, $1), updated_at = NOW()
          WHERE id = $2::uuid
        `,
        [agent, input.leadId]
      );
      assigned = true;
    }
  }

  if (!assigned && !hasPreAssignment) {
    const fallback = await pickFallbackAgent(input.conversationId);
    if (fallback) {
      await pool.query(
        `
          UPDATE pendencias.crm_conversations
          SET assigned_username = COALESCE(assigned_username, $1), updated_at = NOW()
          WHERE id = $2::uuid
        `,
        [fallback, input.conversationId]
      );
    }
  }

  try {
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
        VALUES ($1::uuid, NULL, 'EVENT', $2, $3::jsonb, NOW())
      `,
      [
        input.leadId,
        `Roteamento automático (${topic})`,
        JSON.stringify({ topic, routing }),
      ]
    );
  } catch {
    // não bloqueia
  }

  return { topic, routing };
}

/** Move lead para estágio e recalcula position no destino (fim da coluna). */
export async function moveLeadToStage(leadId: string, stageId: string) {
  const pool = getPool();
  const leadRes = await pool.query(`SELECT pipeline_id, stage_id FROM pendencias.crm_leads WHERE id = $1::uuid`, [leadId]);
  const pipelineId = leadRes.rows?.[0]?.pipeline_id as string | undefined;
  const currentStage = leadRes.rows?.[0]?.stage_id as string | undefined;
  if (!pipelineId) return;
  if (String(currentStage || "") === String(stageId)) return;
  const posRow = await pool.query(
    `
      SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
      FROM pendencias.crm_leads
      WHERE pipeline_id = $1 AND stage_id = $2::uuid
    `,
    [pipelineId, stageId]
  );
  const nextPos = Number(posRow.rows?.[0]?.next_pos || 0);
  await pool.query(
    `
      UPDATE pendencias.crm_leads
      SET stage_id = $1::uuid, position = $2, updated_at = NOW()
      WHERE id = $3::uuid
    `,
    [stageId, nextPos, leadId]
  );
}

export async function resolveSlaMinutes(params: {
  teamId?: string | null;
  topic?: string | null;
  channel?: string | null;
  priority?: string | null;
}) {
  const pool = getPool();
  const res = await pool.query(
    `
      SELECT sla_minutes
      FROM pendencias.crm_queue_sla
      WHERE is_active = true
        AND ($1::uuid IS NULL OR team_id IS NULL OR team_id = $1::uuid)
        AND ($2::text IS NULL OR topic IS NULL OR LOWER(topic) = LOWER($2::text))
        AND ($3::text IS NULL OR channel IS NULL OR UPPER(channel) = UPPER($3::text))
        AND ($4::text IS NULL OR priority IS NULL OR UPPER(priority) = UPPER($4::text))
      ORDER BY
        CASE WHEN team_id IS NULL THEN 1 ELSE 0 END,
        CASE WHEN topic IS NULL THEN 1 ELSE 0 END,
        CASE WHEN channel IS NULL THEN 1 ELSE 0 END,
        CASE WHEN priority IS NULL THEN 1 ELSE 0 END,
        updated_at DESC
      LIMIT 1
    `,
    [params.teamId || null, params.topic || null, params.channel || null, params.priority || null]
  );
  const minutes = Number(res.rows?.[0]?.sla_minutes || 30);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
}
