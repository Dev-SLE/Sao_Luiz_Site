export async function ensureDefaultPipelineAndFirstStage(pool: any) {
  let pipelineRes = await pool.query(
    "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
  );
  let pipelineId = pipelineRes.rows?.[0]?.id as string | undefined;
  if (!pipelineId) {
    const anyPipe = await pool.query(
      "SELECT id FROM pendencias.crm_pipelines ORDER BY created_at ASC LIMIT 1"
    );
    pipelineId = anyPipe.rows?.[0]?.id as string | undefined;
  }
  if (!pipelineId) {
    await pool.query("UPDATE pendencias.crm_pipelines SET is_default = false");
    const pipelineInsert = await pool.query(
      `
        INSERT INTO pendencias.crm_pipelines (name, description, is_default, created_by, created_at, updated_at)
        VALUES ('Funil Padrão', 'Funil criado automaticamente', true, 'system', NOW(), NOW())
        RETURNING id
      `
    );
    pipelineId = pipelineInsert.rows?.[0]?.id as string | undefined;
    if (!pipelineId) return null;
    const stages = [
      "Aguardando atendimento",
      "Em busca de mercadorias",
      "Ocorrências",
      "Atendimento finalizado",
    ];
    for (let i = 0; i < stages.length; i++) {
      await pool.query(
        `
          INSERT INTO pendencias.crm_stages (pipeline_id, name, position, created_at)
          VALUES ($1, $2, $3, NOW())
        `,
        [pipelineId, stages[i], i]
      );
    }
  }

  const stageRes = await pool.query(
    "SELECT id FROM pendencias.crm_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1",
    [pipelineId]
  );
  let stageId = stageRes.rows?.[0]?.id as string | undefined;
  if (!stageId) {
    const ins = await pool.query(
      `
        INSERT INTO pendencias.crm_stages (pipeline_id, name, position, created_at)
        VALUES ($1, 'Aguardando atendimento', 0, NOW())
        RETURNING id
      `,
      [pipelineId]
    );
    stageId = ins.rows?.[0]?.id as string | undefined;
  }
  if (!pipelineId || !stageId) return null;
  return { pipelineId, stageId };
}
