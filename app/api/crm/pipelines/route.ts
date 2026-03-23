import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
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
    // Então movemos os leads do pipeline antigo (default) para o novo pipeline (stage inicial).
    if (makeDefault && moveLeadsFromOldDefault && previousDefaultId) {
      if (ownerUsernameForMovedLeads) {
        await pool.query(
          `
            UPDATE pendencias.crm_leads
            SET
              pipeline_id = $1,
              stage_id = $2,
              position = 0,
              owner_username = $3,
              updated_at = NOW()
            WHERE pipeline_id = $4
          `,
          [pipelineId, stageIds[0], ownerUsernameForMovedLeads, previousDefaultId]
        );
      } else {
        await pool.query(
          `
            UPDATE pendencias.crm_leads
            SET
              pipeline_id = $1,
              stage_id = $2,
              position = 0,
              updated_at = NOW()
            WHERE pipeline_id = $3
          `,
          [pipelineId, stageIds[0], previousDefaultId]
        );
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

