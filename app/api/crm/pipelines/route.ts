import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.manage"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const description = body?.description != null ? String(body.description).trim() : "Funil criado via CRM";
    const columnsRaw = body?.columns;
    const makeDefault = body?.makeDefault !== undefined ? Boolean(body.makeDefault) : true;
    const moveLeadsFromOldDefault =
      body?.moveLeadsFromOldDefault !== undefined ? Boolean(body.moveLeadsFromOldDefault) : true;
    const createdBy = body?.createdBy != null ? String(body.createdBy).trim() : "system";
    const ownerUsernameForMovedLeads =
      body?.ownerUsernameForMovedLeads != null && String(body.ownerUsernameForMovedLeads).trim() !== ""
        ? String(body.ownerUsernameForMovedLeads).trim()
        : null;

    const columns: string[] =
      Array.isArray(columnsRaw)
        ? columnsRaw.map((c: any) => String(c).trim()).filter(Boolean)
        : String(columnsRaw || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);

    if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
    if (columns.length < 2) {
      return NextResponse.json({ error: "colunas insuficientes" }, { status: 400 });
    }

    let previousDefaultId: string | undefined;
    if (makeDefault) {
      const prevDefault = await pool.query(
        "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
      );
      previousDefaultId = prevDefault.rows?.[0]?.id as string | undefined;

      // Torna o novo pipeline o padrão
      await pool.query("UPDATE pendencias.crm_pipelines SET is_default = false");
    }

    const pipelineInsert = await pool.query(
      `
        INSERT INTO pendencias.crm_pipelines (name, description, is_default, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
      `,
      [name, description, makeDefault, createdBy]
    );
    const pipelineId = pipelineInsert.rows?.[0]?.id as string;

    const stageIds: string[] = [];
    for (let i = 0; i < columns.length; i++) {
      const stageRes = await pool.query(
        `
          INSERT INTO pendencias.crm_stages (pipeline_id, name, position, created_at)
          VALUES ($1, $2, $3, NOW())
          RETURNING id
        `,
        [pipelineId, columns[i], i]
      );
      stageIds.push(stageRes.rows?.[0]?.id as string);
    }

    // Mantém a experiência do front: a board sempre mostra o funil padrão.
    // Ao trocar o default, preserva estágio relativo dos leads (por posição da coluna),
    // evitando reset de todos para a primeira etapa.
    if (makeDefault && moveLeadsFromOldDefault && previousDefaultId) {
      const movedLeadsRes = await pool.query(
        `
          SELECT
            l.id,
            l.position,
            st.position AS stage_position
          FROM pendencias.crm_leads l
          JOIN pendencias.crm_stages st ON st.id = l.stage_id
          WHERE l.pipeline_id = $1
          ORDER BY st.position ASC, l.position ASC, l.created_at ASC
        `,
        [previousDefaultId]
      );
      const movedLeads = movedLeadsRes.rows || [];
      if (movedLeads.length > 0) {
        const targetStageCount = stageIds.length;
        const buckets = new Map<number, Array<{ id: string }>>();
        for (const row of movedLeads) {
          const oldStagePos = Math.max(0, Number(row.stage_position || 0));
          const targetStagePos = Math.min(oldStagePos, Math.max(0, targetStageCount - 1));
          if (!buckets.has(targetStagePos)) buckets.set(targetStagePos, []);
          buckets.get(targetStagePos)!.push({ id: String(row.id) });
        }

        await pool.query("BEGIN");
        try {
          for (let stagePos = 0; stagePos < targetStageCount; stagePos++) {
            const list = buckets.get(stagePos) || [];
            for (let idx = 0; idx < list.length; idx++) {
              const lead = list[idx];
              if (ownerUsernameForMovedLeads) {
                await pool.query(
                  `
                    UPDATE pendencias.crm_leads
                    SET
                      pipeline_id = $1,
                      stage_id = $2,
                      position = $3,
                      owner_username = $4,
                      updated_at = NOW()
                    WHERE id = $5
                  `,
                  [pipelineId, stageIds[stagePos], idx, ownerUsernameForMovedLeads, lead.id]
                );
              } else {
                await pool.query(
                  `
                    UPDATE pendencias.crm_leads
                    SET
                      pipeline_id = $1,
                      stage_id = $2,
                      position = $3,
                      updated_at = NOW()
                    WHERE id = $4
                  `,
                  [pipelineId, stageIds[stagePos], idx, lead.id]
                );
              }
            }
          }
          await pool.query("COMMIT");
        } catch (e) {
          await pool.query("ROLLBACK");
          throw e;
        }
      }
    }

    const stagesRes = await pool.query(
      `
        SELECT id, name, position
        FROM pendencias.crm_stages
        WHERE pipeline_id = $1
        ORDER BY position ASC
      `,
      [pipelineId]
    );

    return NextResponse.json({
      pipeline: { id: pipelineId, name },
      stages: (stagesRes.rows || []).map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        position: Number(r.position || 0),
      })),
    });
  } catch (error) {
    console.error("CRM pipelines POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

