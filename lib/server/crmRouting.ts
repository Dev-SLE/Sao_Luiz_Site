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

export async function resolveRoutingByRules(input: {
  text?: string | null;
  title?: string | null;
  cte?: string | null;
  leadId?: string | null;
}) {
  const pool = getPool();
  const topic = classifyLeadTopic(input);
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
      SELECT username, role
      FROM pendencias.users
      WHERE COALESCE(TRIM(username), '') <> ''
    `
  );
  const users = (usersRes.rows || [])
    .map((r: any) => ({ username: String(r.username), role: String(r.role || "") }))
    .filter((u) => {
      const role = u.role.toLowerCase();
      return role.includes("atend") || role.includes("vended") || role.includes("comercial") || role === "admin";
    });

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
      SELECT username
      FROM pendencias.crm_team_members
      WHERE team_id = $1 AND is_active = true
    `,
    [teamId]
  );
  const members = (membersRes.rows || []).map((r: any) => String(r.username)).filter(Boolean);
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

/**
 * Após inbound (ex.: WhatsApp): classifica tópico, aplica regras e atribui estágio/atendente quando configurado.
 */
export async function applyInboundRouting(input: {
  leadId: string;
  conversationId: string;
  text?: string | null;
  title?: string | null;
  cte?: string | null;
}) {
  const pool = getPool();
  const topic = classifyLeadTopic(input);
  const routing = await resolveRoutingByRules({
    text: input.text,
    title: input.title,
    cte: input.cte,
    leadId: input.leadId,
  });

  await pool.query(
    `
      UPDATE pendencias.crm_conversations
      SET topic = $1, routing_source = $2, updated_at = NOW()
      WHERE id = $3::uuid
    `,
    [topic, routing.source === "RULE" ? "RULE" : "TOPIC", input.conversationId]
  );

  if (routing.targetStageId) {
    await pool.query(
      `
        UPDATE pendencias.crm_leads
        SET stage_id = $1::uuid, updated_at = NOW()
        WHERE id = $2::uuid
      `,
      [routing.targetStageId, input.leadId]
    );
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

  if (!assigned) {
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
