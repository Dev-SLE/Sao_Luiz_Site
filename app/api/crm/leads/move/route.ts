import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../../lib/server/apiAuth";
import { sessionCanAccessLead } from "../../../../../lib/server/crmAccess";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["crm.leads.edit", "module.crm.manage"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId ? String(body.leadId) : null;
    const stageIdInput = body?.stageId ? String(body.stageId) : null;
    const action = body?.action ? String(body.action).toUpperCase() : null;
    const agencyId = body?.agencyId ? String(body.agencyId) : null;
    const slaMinutesRaw = body?.slaMinutes;
    const slaMinutes =
      slaMinutesRaw == null || String(slaMinutesRaw).trim() === "" ? null : Number(slaMinutesRaw);
    if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });

    const leadRes = await pool.query("SELECT pipeline_id FROM pendencias.crm_leads WHERE id = $1", [leadId]);
    const lead = leadRes.rows?.[0];
    if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });
    if (guard.session && !(await sessionCanAccessLead(pool, guard.session, leadId))) {
      return NextResponse.json({ error: "Sem acesso ao lead" }, { status: 403 });
    }

    let stageId = stageIdInput;
    let stageNameForLog = "";
    let forceCustomerStatus: string | null = null;
    let agencyRequestedAt: string | null = null;
    let agencySlaMinutes: number | null = null;

    if (action === "REQUEST_AGENCY_RETURN") {
      const waitAgencyStageRes = await pool.query(
        `
          SELECT id, name
          FROM pendencias.crm_stages
          WHERE pipeline_id = $1
            AND LOWER(name) = LOWER('Aguardando retorno de agência')
          LIMIT 1
        `,
        [lead.pipeline_id]
      );
      const waitAgencyStage = waitAgencyStageRes.rows?.[0];
      if (!waitAgencyStage) {
        return NextResponse.json({ error: "Etapa 'Aguardando retorno de agência' não encontrada no funil" }, { status: 400 });
      }
      stageId = String(waitAgencyStage.id);
      stageNameForLog = String(waitAgencyStage.name);
      forceCustomerStatus = "AGUARDANDO_RETORNO_AGENCIA";
      agencyRequestedAt = new Date().toISOString();
      if (agencyId) {
        const agencyRes = await pool.query(
          `SELECT avg_response_minutes FROM pendencias.crm_agencies WHERE id = $1 LIMIT 1`,
          [agencyId]
        );
        const agencyAvg = agencyRes.rows?.[0]?.avg_response_minutes;
        agencySlaMinutes =
          Number.isFinite(Number(slaMinutes)) && Number(slaMinutes) > 0
            ? Number(slaMinutes)
            : Number.isFinite(Number(agencyAvg)) && Number(agencyAvg) > 0
              ? Number(agencyAvg)
              : 60;
      } else {
        agencySlaMinutes = Number.isFinite(Number(slaMinutes)) && Number(slaMinutes) > 0 ? Number(slaMinutes) : 60;
      }
    }

    if (!stageId) return NextResponse.json({ error: "stageId obrigatório" }, { status: 400 });

    const stageRes = await pool.query(
      "SELECT id, name, pipeline_id FROM pendencias.crm_stages WHERE id = $1",
      [stageId]
    );
    const stage = stageRes.rows?.[0];
    if (!stage) return NextResponse.json({ error: "stage não encontrado" }, { status: 404 });

    if (String(stage.pipeline_id) !== String(lead.pipeline_id)) {
      return NextResponse.json({ error: "stage não pertence ao pipeline do lead" }, { status: 400 });
    }

    const positionRow = await pool.query(
      `
        SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
        FROM pendencias.crm_leads
        WHERE pipeline_id = $1 AND stage_id = $2
      `,
      [lead.pipeline_id, stageId]
    );
    const nextPos = Number(positionRow.rows?.[0]?.next_pos || 0);

    await pool.query(
      `
        UPDATE pendencias.crm_leads
        SET
          stage_id = $1,
          position = $2,
          customer_status = COALESCE($3, customer_status),
          agency_id = CASE WHEN $4::text IS NULL THEN agency_id ELSE $4::uuid END,
          agency_requested_at = CASE WHEN $5::text IS NULL THEN agency_requested_at ELSE $5::timestamptz END,
          agency_sla_minutes = CASE WHEN $6::int IS NULL THEN agency_sla_minutes ELSE $6::int END,
          updated_at = NOW()
        WHERE id = $7
      `,
      [stageId, nextPos, forceCustomerStatus, agencyId, agencyRequestedAt, agencySlaMinutes, leadId]
    );

    const activityUser = body?.ownerUsername != null ? String(body.ownerUsername) : null;
    const effectiveStageName = stageNameForLog || String(stage.name);
    const logDescription =
      action === "REQUEST_AGENCY_RETURN"
        ? `Atendente acionou agência. Lead movido para "${effectiveStageName}". Cliente permanece atendido pelo time interno.`
        : `Lead movido para "${effectiveStageName}"`;
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, created_at)
        VALUES ($1, $2, 'EVENT', $3, NOW())
      `,
      [leadId, activityUser, logDescription]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM leads move PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

