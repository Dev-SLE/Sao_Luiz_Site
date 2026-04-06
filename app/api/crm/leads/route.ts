import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { classifyLeadTopic } from "../../../../lib/server/crmRouting";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";

export const runtime = "nodejs";

function buildProtocolNumber() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `LD-${stamp}-${rand}`;
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const phone = body?.phone != null ? String(body.phone) : null;
    const cte = body?.cte != null ? String(body.cte) : null;
    const cteSerie = body?.cteSerie != null ? String(body.cteSerie) : null;

    const freteValueRaw = body?.freteValue ?? body?.frete_value ?? null;
    const freteValue =
      freteValueRaw === null || freteValueRaw === undefined || String(freteValueRaw).trim() === ""
        ? null
        : Number(String(freteValueRaw).replace(",", "."));

    const source = String(body?.source || "MANUAL").toUpperCase();
    const priority = String(body?.priority || "MEDIA").toUpperCase();
    const topic = String(body?.topic || classifyLeadTopic({ title, cte })).toUpperCase();
    const protocolNumber = body?.protocolNumber ? String(body.protocolNumber).trim() : buildProtocolNumber();
    const mdfeDate = body?.mdfeDate ? String(body.mdfeDate) : null;
    const routeOrigin = body?.routeOrigin ? String(body.routeOrigin) : null;
    const routeDestination = body?.routeDestination ? String(body.routeDestination) : null;
    const requestedAt = body?.requestedAt ? String(body.requestedAt) : new Date().toISOString();
    const serviceType = body?.serviceType ? String(body.serviceType).toUpperCase() : "ATENDIMENTO_GERAL";
    const cargoStatus = body?.cargoStatus ? String(body.cargoStatus).toUpperCase() : "SEM_STATUS";
    let customerStatus = body?.customerStatus ? String(body.customerStatus).toUpperCase() : "PENDENTE";
    const agencyId = body?.agencyId ? String(body.agencyId) : null;
    let agencyRequestedAt: string | null = null;
    let agencySlaMinutes: number | null = null;
    const assignedUsername = body?.assignedUsername != null ? String(body.assignedUsername) : (body?.ownerUsername != null ? String(body.ownerUsername) : null);
    const assignmentMode = body?.assignmentMode != null ? String(body.assignmentMode).toUpperCase() : "AUTO";
    const isRecurringFreight = body?.isRecurringFreight === true;
    const trackingActive = body?.trackingActive === true;
    const observations = body?.observations != null ? String(body.observations) : null;

    const pipelineId =
      body?.pipelineId
        ? String(body.pipelineId)
        : (
            await pool.query(
              "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
            )
          ).rows?.[0]?.id;

    if (!pipelineId) return NextResponse.json({ error: "pipeline não definido" }, { status: 400 });

    let stageId =
      body?.stageId ||
      (
        await pool.query(
          `
            SELECT id
            FROM pendencias.crm_stages
            WHERE pipeline_id = $1
            ORDER BY position ASC
            LIMIT 1
          `,
          [pipelineId]
        )
      ).rows?.[0]?.id;

    if (!stageId) return NextResponse.json({ error: "stage não definida" }, { status: 400 });

    if (agencyId && !body?.stageId) {
      const waitStageRes = await pool.query(
        `
          SELECT id
          FROM pendencias.crm_stages
          WHERE pipeline_id = $1 AND LOWER(name) = LOWER('Aguardando retorno de agência')
          LIMIT 1
        `,
        [pipelineId]
      );
      const waitStageId = waitStageRes.rows?.[0]?.id;
      if (waitStageId) {
        stageId = String(waitStageId);
        agencyRequestedAt = new Date().toISOString();
        customerStatus = "AGUARDANDO_RETORNO_AGENCIA";
      }
      const agencyRes = await pool.query(
        `SELECT avg_response_minutes FROM pendencias.crm_agencies WHERE id = $1 LIMIT 1`,
        [agencyId]
      );
      const agencyAvg = agencyRes.rows?.[0]?.avg_response_minutes;
      agencySlaMinutes =
        Number.isFinite(Number(agencyAvg)) && Number(agencyAvg) > 0 ? Number(agencyAvg) : 60;
    }

    const positionRow = await pool.query(
      `
        SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
        FROM pendencias.crm_leads
        WHERE pipeline_id = $1 AND stage_id = $2
      `,
      [pipelineId, stageId]
    );
    const position = Number(positionRow.rows?.[0]?.next_pos || 0);

    // Busca nome da etapa para log
    const stageNameRes = await pool.query("SELECT name FROM pendencias.crm_stages WHERE id = $1", [stageId]);
    const stageName = stageNameRes.rows?.[0]?.name ? String(stageNameRes.rows[0].name) : "Etapa";

    const insertRes = await pool.query(
      `
        INSERT INTO pendencias.crm_leads (
          pipeline_id,
          stage_id,
          title,
          contact_phone,
          contact_email,
          cte_number,
          cte_serie,
          frete_value,
          source,
          priority,
          current_location,
          owner_username,
          topic,
          assigned_username,
          assignment_mode,
          protocol_number,
          mdfe_date,
          route_origin,
          route_destination,
          requested_at,
          service_type,
          cargo_status,
          customer_status,
          agency_id,
          agency_requested_at,
          agency_sla_minutes,
          is_recurring_freight,
          tracking_active,
          observations,
          position,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW(),NOW())
        RETURNING *
      `,
      [
        pipelineId,
        stageId,
        title,
        phone,
        body?.email != null ? String(body.email) : null,
        cte,
        cteSerie,
        freteValue,
        source,
        priority,
        body?.currentLocation != null ? String(body.currentLocation) : null,
        body?.ownerUsername != null ? String(body.ownerUsername) : null,
        topic,
        assignedUsername,
        assignmentMode,
        protocolNumber,
        mdfeDate,
        routeOrigin,
        routeDestination,
        requestedAt,
        serviceType,
        cargoStatus,
        customerStatus,
        agencyId,
        agencyRequestedAt,
        agencySlaMinutes,
        position,
        isRecurringFreight,
        trackingActive,
        observations,
      ]
    );

    const lead = insertRes.rows?.[0];

    // Log inicial
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, created_at)
        VALUES ($1, $2, 'EVENT', $3, NOW())
      `,
      [lead.id, body?.ownerUsername != null ? String(body.ownerUsername) : null, `Lead criado em "${stageName}"`]
    );

    return NextResponse.json({
      lead: {
        id: lead.id as string,
        title: lead.title as string,
        phone: lead.contact_phone as string | null,
        cte: lead.cte_number as string | null,
        email: lead.contact_email as string | null,
        freteValue: lead.frete_value != null ? Number(lead.frete_value) : undefined,
        source: lead.source as string,
        priority: lead.priority as string,
        topic: lead.topic as string | null,
        assignedUsername: lead.assigned_username as string | null,
        assignmentMode: lead.assignment_mode as string,
        currentLocation: lead.current_location as string | null,
        protocolNumber: lead.protocol_number as string | null,
        mdfeDate: lead.mdfe_date as string | null,
        routeOrigin: lead.route_origin as string | null,
        routeDestination: lead.route_destination as string | null,
        requestedAt: lead.requested_at as string | null,
        serviceType: lead.service_type as string | null,
        cargoStatus: lead.cargo_status as string | null,
        customerStatus: lead.customer_status as string | null,
        agencyId: lead.agency_id as string | null,
        agencyRequestedAt: lead.agency_requested_at as string | null,
        agencySlaMinutes: lead.agency_sla_minutes != null ? Number(lead.agency_sla_minutes) : null,
        isRecurringFreight: !!lead.is_recurring_freight,
        trackingActive: !!lead.tracking_active,
        observations: lead.observations ? String(lead.observations) : "",
        stageId: lead.stage_id as string,
        logs: [`Lead criado em "${stageName}"`],
      },
    });
  } catch (error) {
    console.error("CRM leads POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId != null ? String(body.leadId) : null;
    if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });

    const leadRes = await pool.query(
      `
        SELECT
          id,
          pipeline_id,
          stage_id,
          position,
          title
        FROM pendencias.crm_leads
        WHERE id = $1
      `,
      [leadId]
    );
    const lead = leadRes.rows?.[0];
    if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

    const pipelineId = String(lead.pipeline_id);

    const titleRaw = body?.title != null ? String(body.title).trim() : String(lead.title || "").trim();
    if (!titleRaw) return NextResponse.json({ error: "title obrigatório" }, { status: 400 });

    const phone = body?.phone != null ? String(body.phone).trim() : null;
    const email = body?.email != null ? String(body.email).trim() : null;
    const cte = body?.cte != null ? String(body.cte).trim() : null;
    const cteSerie = body?.cteSerie != null ? String(body.cteSerie).trim() : null;

    const freteValueRaw = body?.freteValue ?? body?.frete_value ?? null;
    const freteValue =
      freteValueRaw === null || freteValueRaw === undefined || String(freteValueRaw).trim() === ""
        ? null
        : Number(String(freteValueRaw).replace(",", "."));

    const source = String(body?.source ?? "MANUAL").toUpperCase();
    const priority = String(body?.priority ?? "MEDIA").toUpperCase();
    const topic = body?.topic != null ? String(body.topic).toUpperCase() : null;
    const protocolNumber = body?.protocolNumber != null ? String(body.protocolNumber).trim() : null;
    const mdfeDate = body?.mdfeDate != null ? String(body.mdfeDate).trim() : null;
    const routeOrigin = body?.routeOrigin != null ? String(body.routeOrigin).trim() : null;
    const routeDestination = body?.routeDestination != null ? String(body.routeDestination).trim() : null;
    const requestedAt = body?.requestedAt != null ? String(body.requestedAt).trim() : null;
    const serviceType = body?.serviceType != null ? String(body.serviceType).toUpperCase().trim() : null;
    const cargoStatus = body?.cargoStatus != null ? String(body.cargoStatus).toUpperCase().trim() : null;
    const customerStatus = body?.customerStatus != null ? String(body.customerStatus).toUpperCase().trim() : null;
    const agencyId = body?.agencyId !== undefined ? (body.agencyId ? String(body.agencyId).trim() : null) : undefined;
    const assignedUsername =
      body?.assignedUsername != null && String(body.assignedUsername).trim() !== ""
        ? String(body.assignedUsername).trim()
        : null;
    const assignmentMode = body?.assignmentMode != null ? String(body.assignmentMode).toUpperCase() : "AUTO";
    const isRecurringFreight = body?.isRecurringFreight !== undefined ? !!body.isRecurringFreight : undefined;
    const trackingActive = body?.trackingActive !== undefined ? !!body.trackingActive : undefined;
    const observations = body?.observations !== undefined ? String(body.observations || "") : undefined;

    const currentLocation =
      body?.currentLocation != null && String(body.currentLocation).trim() !== ""
        ? String(body.currentLocation).trim()
        : null;

    const ownerUsername =
      body?.ownerUsername != null && String(body.ownerUsername).trim() !== ""
        ? String(body.ownerUsername).trim()
        : null;

    const stageIdProvided = body?.stageId != null && String(body.stageId).trim() !== "" ? String(body.stageId) : null;

    let nextStageId = String(lead.stage_id);
    let nextPosition = Number(lead.position || 0);
    if (stageIdProvided && stageIdProvided !== String(lead.stage_id)) {
      const stageRes = await pool.query(
        "SELECT id, pipeline_id FROM pendencias.crm_stages WHERE id = $1",
        [stageIdProvided]
      );
      const stage = stageRes.rows?.[0];
      if (!stage) return NextResponse.json({ error: "stage não encontrada" }, { status: 404 });
      if (String(stage.pipeline_id) !== pipelineId) {
        return NextResponse.json({ error: "stage não pertence ao pipeline do lead" }, { status: 400 });
      }

      const positionRow = await pool.query(
        `
          SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
          FROM pendencias.crm_leads
          WHERE pipeline_id = $1 AND stage_id = $2
        `,
        [pipelineId, stageIdProvided]
      );
      nextStageId = stageIdProvided;
      nextPosition = Number(positionRow.rows?.[0]?.next_pos || 0);
    }

    const updated = await pool.query(
      `
        UPDATE pendencias.crm_leads
        SET
          title = $1,
          contact_phone = $2,
          contact_email = $3,
          cte_number = $4,
          cte_serie = $5,
          frete_value = $6,
          source = $7,
          priority = $8,
          current_location = $9,
          owner_username = $10,
          topic = COALESCE($11, topic),
          assigned_username = $12,
          assignment_mode = $13,
          protocol_number = COALESCE($14, protocol_number),
          mdfe_date = CASE WHEN $15::text IS NULL THEN mdfe_date ELSE $15::timestamptz END,
          route_origin = COALESCE($16, route_origin),
          route_destination = COALESCE($17, route_destination),
          requested_at = CASE WHEN $18::text IS NULL THEN requested_at ELSE $18::timestamptz END,
          service_type = COALESCE($19, service_type),
          cargo_status = COALESCE($20, cargo_status),
          customer_status = COALESCE($21, customer_status),
          agency_id = CASE WHEN $22::text IS NULL THEN agency_id ELSE $22::uuid END,
          stage_id = $23,
          position = $24,
          is_recurring_freight = COALESCE($26, is_recurring_freight),
          tracking_active = COALESCE($27, tracking_active),
          observations = CASE WHEN $28::text IS NULL THEN observations ELSE $28::text END,
          updated_at = NOW()
        WHERE id = $25
        RETURNING *
      `,
      [
        titleRaw,
        phone,
        email,
        cte,
        cteSerie,
        freteValue,
        source,
        priority,
        currentLocation,
        ownerUsername,
        topic,
        assignedUsername,
        assignmentMode,
        protocolNumber,
        mdfeDate,
        routeOrigin,
        routeDestination,
        requestedAt,
        serviceType,
        cargoStatus,
        customerStatus,
        agencyId ?? null,
        nextStageId,
        nextPosition,
        leadId,
        isRecurringFreight ?? null,
        trackingActive ?? null,
        observations ?? null,
      ]
    );

    const updatedLead = updated.rows?.[0];

    // Log
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, created_at)
        VALUES ($1, $2, 'EVENT', $3, NOW())
      `,
      [
        leadId,
        body?.updatedByUsername != null ? String(body.updatedByUsername) : body?.ownerUsername != null ? String(body.ownerUsername) : null,
        `Lead atualizado: "${titleRaw}"`
      ]
    );

    return NextResponse.json({ lead: updatedLead });
  } catch (error) {
    console.error("CRM leads PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();

    const url = new URL(req.url);
    const leadIdFromQuery = url.searchParams.get("leadId");

    const body = await req.json().catch(() => ({}));
    const leadId = body?.leadId != null ? String(body.leadId) : (leadIdFromQuery ? String(leadIdFromQuery) : null);

    if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });

    const deleted = await pool.query(
      "DELETE FROM pendencias.crm_leads WHERE id = $1 RETURNING id, title",
      [leadId]
    );

    const row = deleted.rows?.[0];
    if (!row) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

    // Log simples (para rastreio)
    await pool.query(
      `
        INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, created_at)
        VALUES ($1, $2, 'EVENT', $3, NOW())
      `,
      [leadId, body?.deletedByUsername != null ? String(body.deletedByUsername) : null, `Lead excluído: "${String(row.title || '')}"`]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM leads DELETE error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

