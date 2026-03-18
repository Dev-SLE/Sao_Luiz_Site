import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
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

    const pipelineId =
      body?.pipelineId
        ? String(body.pipelineId)
        : (
            await pool.query(
              "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
            )
          ).rows?.[0]?.id;

    if (!pipelineId) return NextResponse.json({ error: "pipeline não definido" }, { status: 400 });

    const stageId =
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
          position,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
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
        position,
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
        currentLocation: lead.current_location as string | null,
        stageId: lead.stage_id as string,
        logs: [`Lead criado em "${stageName}"`],
      },
    });
  } catch (error) {
    console.error("CRM leads POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

