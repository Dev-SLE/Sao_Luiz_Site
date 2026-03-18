import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

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

async function ensureDefaultPipeline(pool: any) {
  const existing = await pool.query(
    "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
  );
  if (existing.rows?.length) return existing.rows[0].id as string;

  // Cria um funil padrão com etapas comuns
  const pipelineInsert = await pool.query(
    `
      INSERT INTO pendencias.crm_pipelines (name, description, is_default, created_by, created_at, updated_at)
      VALUES ('Funil Padrão', 'Funil criado automaticamente', true, 'system', NOW(), NOW())
      RETURNING id
    `
  );
  const pipelineId = pipelineInsert.rows?.[0]?.id as string;

  const stages = ["Novos", "Qualificando", "Negociando", "Fechado"];
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

export async function GET() {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const pipelineId = await ensureDefaultPipeline(pool);

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
        l.stage_id,
        l.position,
        st.name AS stage_name,
        COALESCE(logs_sub.logs, '[]'::jsonb) AS logs
      FROM pendencias.crm_leads l
      JOIN pendencias.crm_stages st ON st.id = l.stage_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(a.description ORDER BY a.created_at DESC) AS logs
        FROM pendencias.crm_activities a
        WHERE a.lead_id = l.id
        LIMIT 15
      ) logs_sub ON true
      WHERE l.pipeline_id = $1
      ORDER BY st.position ASC, l.position ASC
      `,
      [pipelineId]
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
      stageId: r.stage_id as string,
      logs: parseJsonbArray(r.logs),
    }));

    return NextResponse.json({
      pipeline: pipeline
        ? { id: pipeline.id as string, name: pipeline.name as string }
        : null,
      stages,
      leads,
    });
  } catch (error) {
    console.error("CRM board GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

