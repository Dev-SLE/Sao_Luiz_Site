import type { Pool } from "pg";

const ATIVO_BLOQUEIA_MOV = new Set(["BAIXADO"]);

export type ListAtivosParams = {
  q?: string;
  agencia?: string;
  categoria?: string;
  status?: string;
  responsavel?: string;
  limit: number;
  offset: number;
};

export async function listAtivos(pool: Pool, p: ListAtivosParams) {
  const cond: string[] = ["1=1"];
  const args: unknown[] = [];
  let i = 1;
  if (p.q?.trim()) {
    const s = `%${p.q.trim().replace(/%/g, "").replace(/_/g, "")}%`;
    cond.push(
      `(a.numero_patrimonio ILIKE $${i} OR a.descricao ILIKE $${i} OR coalesce(a.numero_serie,'') ILIKE $${i})`,
    );
    args.push(s);
    i++;
  }
  if (p.agencia?.trim()) {
    cond.push(`trim(coalesce(a.agencia_atual,'')) = $${i++}`);
    args.push(p.agencia.trim());
  }
  if (p.categoria?.trim()) {
    cond.push(`a.categoria = $${i++}`);
    args.push(p.categoria.trim());
  }
  if (p.status?.trim()) {
    cond.push(`a.status = $${i++}`);
    args.push(p.status.trim());
  }
  if (p.responsavel?.trim()) {
    cond.push(`trim(coalesce(a.responsavel_atual,'')) ILIKE $${i++}`);
    args.push(`%${p.responsavel.trim().replace(/%/g, "")}%`);
  }
  const where = cond.join(" AND ");
  const c = await pool.query(`SELECT count(*)::bigint AS c FROM pendencias.patrimonio_ativos a WHERE ${where}`, args);
  const total = Number(c.rows?.[0]?.c ?? 0) || 0;
  const r = await pool.query(
    `SELECT a.* FROM pendencias.patrimonio_ativos a WHERE ${where} ORDER BY a.updated_at DESC, a.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...args, p.limit, p.offset],
  );
  return { rows: r.rows || [], total };
}

export async function getAtivo(pool: Pool, id: string) {
  const r = await pool.query(`SELECT * FROM pendencias.patrimonio_ativos WHERE id = $1::uuid`, [id]);
  return r.rows?.[0] || null;
}

export async function insertAtivo(
  pool: Pool,
  body: Record<string, unknown>,
  username: string,
) {
  const r = await pool.query(
    `
    INSERT INTO pendencias.patrimonio_ativos (
      numero_patrimonio, descricao, categoria, subcategoria, marca, modelo, numero_serie,
      estado_conservacao, status, agencia_atual, centro_custo, responsavel_atual,
      data_aquisicao, valor_aquisicao, fornecedor, numero_nf, observacoes
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, coalesce($9,'ATIVO'), $10, $11, $12, $13, $14, $15, $16, $17
    )
    RETURNING *
  `,
    [
      String(body.numero_patrimonio || "").trim(),
      String(body.descricao || "").trim(),
      String(body.categoria || "").trim(),
      body.subcategoria ? String(body.subcategoria) : null,
      body.marca ? String(body.marca) : null,
      body.modelo ? String(body.modelo) : null,
      body.numero_serie ? String(body.numero_serie) : null,
      body.estado_conservacao ? String(body.estado_conservacao) : null,
      body.status ? String(body.status) : "ATIVO",
      body.agencia_atual ? String(body.agencia_atual) : null,
      body.centro_custo ? String(body.centro_custo) : null,
      body.responsavel_atual ? String(body.responsavel_atual) : null,
      body.data_aquisicao || null,
      body.valor_aquisicao != null && body.valor_aquisicao !== "" ? Number(body.valor_aquisicao) : null,
      body.fornecedor ? String(body.fornecedor) : null,
      body.numero_nf ? String(body.numero_nf) : null,
      body.observacoes ? String(body.observacoes) : null,
    ],
  );
  return r.rows?.[0] || null;
}

export async function updateAtivo(pool: Pool, id: string, body: Record<string, unknown>) {
  const r = await pool.query(
    `
    UPDATE pendencias.patrimonio_ativos SET
      numero_patrimonio = coalesce($2, numero_patrimonio),
      descricao = coalesce($3, descricao),
      categoria = coalesce($4, categoria),
      subcategoria = $5,
      marca = $6,
      modelo = $7,
      numero_serie = $8,
      estado_conservacao = $9,
      status = coalesce($10, status),
      agencia_atual = $11,
      centro_custo = $12,
      responsavel_atual = $13,
      data_aquisicao = $14,
      valor_aquisicao = $15,
      fornecedor = $16,
      numero_nf = $17,
      observacoes = $18,
      updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
  `,
    [
      id,
      body.numero_patrimonio != null ? String(body.numero_patrimonio).trim() : null,
      body.descricao != null ? String(body.descricao).trim() : null,
      body.categoria != null ? String(body.categoria).trim() : null,
      body.subcategoria !== undefined ? (body.subcategoria ? String(body.subcategoria) : null) : null,
      body.marca !== undefined ? (body.marca ? String(body.marca) : null) : null,
      body.modelo !== undefined ? (body.modelo ? String(body.modelo) : null) : null,
      body.numero_serie !== undefined ? (body.numero_serie ? String(body.numero_serie) : null) : null,
      body.estado_conservacao !== undefined
        ? body.estado_conservacao
          ? String(body.estado_conservacao)
          : null
        : null,
      body.status != null ? String(body.status) : null,
      body.agencia_atual !== undefined ? (body.agencia_atual ? String(body.agencia_atual) : null) : null,
      body.centro_custo !== undefined ? (body.centro_custo ? String(body.centro_custo) : null) : null,
      body.responsavel_atual !== undefined
        ? body.responsavel_atual
          ? String(body.responsavel_atual)
          : null
        : null,
      body.data_aquisicao !== undefined ? body.data_aquisicao || null : null,
      body.valor_aquisicao !== undefined
        ? body.valor_aquisicao != null && body.valor_aquisicao !== ""
          ? Number(body.valor_aquisicao)
          : null
        : null,
      body.fornecedor !== undefined ? (body.fornecedor ? String(body.fornecedor) : null) : null,
      body.numero_nf !== undefined ? (body.numero_nf ? String(body.numero_nf) : null) : null,
      body.observacoes !== undefined ? (body.observacoes ? String(body.observacoes) : null) : null,
    ],
  );
  return r.rows?.[0] || null;
}

export async function listMovimentacoes(pool: Pool, ativoId: string | null, limit: number) {
  if (ativoId) {
    const r = await pool.query(
      `
      SELECT m.*, a.numero_patrimonio, a.descricao AS ativo_descricao
      FROM pendencias.patrimonio_movimentacoes m
      JOIN pendencias.patrimonio_ativos a ON a.id = m.ativo_id
      WHERE m.ativo_id = $1::uuid
      ORDER BY m.created_at DESC
      LIMIT $2
    `,
      [ativoId, limit],
    );
    return r.rows || [];
  }
  const r = await pool.query(
    `
    SELECT m.*, a.numero_patrimonio, a.descricao AS ativo_descricao
    FROM pendencias.patrimonio_movimentacoes m
    JOIN pendencias.patrimonio_ativos a ON a.id = m.ativo_id
    ORDER BY m.created_at DESC
    LIMIT $1
  `,
    [limit],
  );
  return r.rows || [];
}

export async function createMovimentacao(
  pool: Pool,
  body: Record<string, unknown>,
  username: string,
): Promise<{ ok: true; row: unknown } | { ok: false; error: string; status: number }> {
  const ativoId = String(body.ativo_id || "");
  const tipo = String(body.tipo_movimentacao || "").trim();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query(`SELECT id, status, agencia_atual, centro_custo, responsavel_atual FROM pendencias.patrimonio_ativos WHERE id = $1::uuid FOR UPDATE`, [ativoId]);
    const ativo = a.rows?.[0];
    if (!ativo) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ativo não encontrado", status: 404 };
    }
    if (ATIVO_BLOQUEIA_MOV.has(String(ativo.status))) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ativo baixado não pode ser movimentado", status: 400 };
    }
    const ins = await client.query(
      `
      INSERT INTO pendencias.patrimonio_movimentacoes (
        ativo_id, tipo_movimentacao, agencia_origem, agencia_destino,
        centro_custo_origem, centro_custo_destino, responsavel_origem, responsavel_destino,
        data_movimentacao, motivo, observacoes, usuario
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, coalesce($9::date, current_date), $10, $11, $12)
      RETURNING *
    `,
      [
        ativoId,
        tipo,
        body.agencia_origem ? String(body.agencia_origem) : ativo.agencia_atual,
        body.agencia_destino != null ? String(body.agencia_destino) : null,
        body.centro_custo_origem ? String(body.centro_custo_origem) : ativo.centro_custo,
        body.centro_custo_destino != null ? String(body.centro_custo_destino) : null,
        body.responsavel_origem ? String(body.responsavel_origem) : ativo.responsavel_atual,
        body.responsavel_destino != null ? String(body.responsavel_destino) : null,
        body.data_movimentacao || null,
        body.motivo ? String(body.motivo) : null,
        body.observacoes ? String(body.observacoes) : null,
        username,
      ],
    );
    const agOrig = ativo.agencia_atual;
    const agDest = body.agencia_destino != null ? String(body.agencia_destino) : ativo.agencia_atual;
    const ccDest =
      body.centro_custo_destino != null ? String(body.centro_custo_destino) : ativo.centro_custo;
    const respDest =
      body.responsavel_destino != null ? String(body.responsavel_destino) : ativo.responsavel_atual;
    const statusNovo =
      tipo === "TRANSFERENCIA" &&
      String(agDest ?? "").trim() !== String(agOrig ?? "").trim() &&
      String(ativo.status) !== "BAIXADO"
        ? "TRANSFERIDO"
        : String(ativo.status);
    await client.query(
      `
      UPDATE pendencias.patrimonio_ativos SET
        agencia_atual = $2,
        centro_custo = $3,
        responsavel_atual = $4,
        status = $5::text,
        updated_at = now()
      WHERE id = $1::uuid
    `,
      [ativoId, agDest, ccDest, respDest, statusNovo],
    );
    await client.query("COMMIT");
    return { ok: true, row: ins.rows?.[0] };
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    const err = e as { code?: string; message?: string };
    if (err.code === "23505") return { ok: false, error: "Número patrimonial duplicado ou conflito", status: 409 };
    throw e;
  } finally {
    client.release();
  }
}

export async function listManutencoes(pool: Pool, ativoId: string | null, limit: number) {
  if (ativoId) {
    const r = await pool.query(
      `
      SELECT m.*, a.numero_patrimonio FROM pendencias.patrimonio_manutencoes m
      JOIN pendencias.patrimonio_ativos a ON a.id = m.ativo_id
      WHERE m.ativo_id = $1::uuid
      ORDER BY m.created_at DESC
      LIMIT $2
    `,
      [ativoId, limit],
    );
    return r.rows || [];
  }
  const r = await pool.query(
    `
    SELECT m.*, a.numero_patrimonio FROM pendencias.patrimonio_manutencoes m
    JOIN pendencias.patrimonio_ativos a ON a.id = m.ativo_id
    ORDER BY m.created_at DESC
    LIMIT $1
  `,
    [limit],
  );
  return r.rows || [];
}

export async function createManutencao(
  pool: Pool,
  body: Record<string, unknown>,
  username: string,
): Promise<{ ok: true; row: unknown } | { ok: false; error: string; status: number }> {
  const ativoId = String(body.ativo_id || "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query(`SELECT id, status FROM pendencias.patrimonio_ativos WHERE id = $1::uuid FOR UPDATE`, [ativoId]);
    const ativo = a.rows?.[0];
    if (!ativo) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ativo não encontrado", status: 404 };
    }
    if (String(ativo.status) === "BAIXADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ativo baixado", status: 400 };
    }
    const ins = await client.query(
      `
      INSERT INTO pendencias.patrimonio_manutencoes (
        ativo_id, data_abertura, data_prevista_retorno, tipo_manutencao, descricao_problema,
        fornecedor_servico, custo_estimado, status, observacoes, usuario
      ) VALUES (
        $1::uuid, coalesce($2::date, current_date), $3::date, $4, $5, $6, $7, 'ABERTA', $8, $9
      ) RETURNING *
    `,
      [
        ativoId,
        body.data_abertura || null,
        body.data_prevista_retorno || null,
        body.tipo_manutencao ? String(body.tipo_manutencao) : null,
        String(body.descricao_problema || "").trim(),
        body.fornecedor_servico ? String(body.fornecedor_servico) : null,
        body.custo_estimado != null && body.custo_estimado !== "" ? Number(body.custo_estimado) : null,
        body.observacoes ? String(body.observacoes) : null,
        username,
      ],
    );
    await client.query(
      `UPDATE pendencias.patrimonio_ativos SET status = 'EM_MANUTENCAO', updated_at = now() WHERE id = $1::uuid`,
      [ativoId],
    );
    await client.query("COMMIT");
    return { ok: true, row: ins.rows?.[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateManutencao(
  pool: Pool,
  id: string,
  body: Record<string, unknown>,
  _username: string,
): Promise<{ ok: true; row: unknown } | { ok: false; error: string; status: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(
      `SELECT m.*, a.status AS ativo_status FROM pendencias.patrimonio_manutencoes m JOIN pendencias.patrimonio_ativos a ON a.id = m.ativo_id WHERE m.id = $1::uuid FOR UPDATE`,
      [id],
    );
    const row = cur.rows?.[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Manutenção não encontrada", status: 404 };
    }
    const newStatus = body.status != null ? String(body.status).trim() : String(row.status);
    if (newStatus === "CONCLUIDA" && String(row.status) === "CONCLUIDA") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Manutenção já concluída", status: 400 };
    }
    const fechar = newStatus === "CONCLUIDA" || newStatus === "CANCELADA";
    const r = await client.query(
      `
      UPDATE pendencias.patrimonio_manutencoes SET
        data_prevista_retorno = COALESCE($2::date, data_prevista_retorno),
        data_fechamento = CASE WHEN $6 THEN COALESCE($3::date, current_date) ELSE data_fechamento END,
        tipo_manutencao = COALESCE($4, tipo_manutencao),
        custo_final = COALESCE($5, custo_final),
        status = $7::text,
        observacoes = COALESCE($8, observacoes),
        updated_at = now()
      WHERE id = $1::uuid
      RETURNING *
    `,
      [
        id,
        body.data_prevista_retorno || null,
        body.data_fechamento || null,
        body.tipo_manutencao ? String(body.tipo_manutencao) : null,
        body.custo_final != null && body.custo_final !== "" ? Number(body.custo_final) : null,
        fechar,
        newStatus,
        body.observacoes ? String(body.observacoes) : null,
      ],
    );
    if (newStatus === "CONCLUIDA" || newStatus === "CANCELADA") {
      const open = await client.query(
        `SELECT count(*)::int AS c FROM pendencias.patrimonio_manutencoes WHERE ativo_id = $1::uuid AND id <> $2::uuid AND status IN ('ABERTA','EM_ANDAMENTO')`,
        [row.ativo_id, id],
      );
      const c = Number(open.rows?.[0]?.c ?? 0) || 0;
      if (c === 0 && String(row.ativo_status) !== "BAIXADO") {
        await client.query(
          `UPDATE pendencias.patrimonio_ativos SET status = 'ATIVO', updated_at = now() WHERE id = $1::uuid`,
          [row.ativo_id],
        );
      }
    }
    if (newStatus === "EM_ANDAMENTO" || newStatus === "ABERTA") {
      await client.query(
        `UPDATE pendencias.patrimonio_ativos SET status = 'EM_MANUTENCAO', updated_at = now() WHERE id = $1::uuid`,
        [row.ativo_id],
      );
    }
    await client.query("COMMIT");
    return { ok: true, row: r.rows?.[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listBaixas(pool: Pool, limit: number) {
  const r = await pool.query(
    `
    SELECT b.*, a.numero_patrimonio, a.descricao AS ativo_descricao
    FROM pendencias.patrimonio_baixas b
    JOIN pendencias.patrimonio_ativos a ON a.id = b.ativo_id
    ORDER BY b.created_at DESC
    LIMIT $1
  `,
    [limit],
  );
  return r.rows || [];
}

export async function createBaixa(
  pool: Pool,
  body: Record<string, unknown>,
  username: string,
): Promise<{ ok: true; row: unknown } | { ok: false; error: string; status: number }> {
  const ativoId = String(body.ativo_id || "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query(`SELECT id, status FROM pendencias.patrimonio_ativos WHERE id = $1::uuid FOR UPDATE`, [ativoId]);
    const ativo = a.rows?.[0];
    if (!ativo) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ativo não encontrado", status: 404 };
    }
    if (String(ativo.status) === "BAIXADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Ativo já baixado", status: 400 };
    }
    const dup = await client.query(`SELECT 1 FROM pendencias.patrimonio_baixas WHERE ativo_id = $1::uuid`, [ativoId]);
    if ((dup.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Baixa já registrada para este ativo", status: 400 };
    }
    const ins = await client.query(
      `
      INSERT INTO pendencias.patrimonio_baixas (
        ativo_id, data_baixa, motivo_baixa, valor_residual, destino_final, aprovado_por, observacoes, usuario
      ) VALUES ($1::uuid, coalesce($2::date, current_date), $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        ativoId,
        body.data_baixa || null,
        String(body.motivo_baixa || "").trim(),
        body.valor_residual != null && body.valor_residual !== "" ? Number(body.valor_residual) : null,
        body.destino_final ? String(body.destino_final) : null,
        body.aprovado_por ? String(body.aprovado_por) : null,
        body.observacoes ? String(body.observacoes) : null,
        username,
      ],
    );
    await client.query(
      `UPDATE pendencias.patrimonio_ativos SET status = 'BAIXADO', updated_at = now() WHERE id = $1::uuid`,
      [ativoId],
    );
    await client.query("COMMIT");
    return { ok: true, row: ins.rows?.[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listConferencias(pool: Pool, limit: number) {
  const r = await pool.query(
    `SELECT * FROM pendencias.patrimonio_conferencias ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows || [];
}

export async function getConferencia(pool: Pool, id: string) {
  const c = await pool.query(`SELECT * FROM pendencias.patrimonio_conferencias WHERE id = $1::uuid`, [id]);
  const conf = c.rows?.[0];
  if (!conf) return null;
  const it = await pool.query(
    `
    SELECT i.*, a.numero_patrimonio, a.descricao, a.status AS ativo_status
    FROM pendencias.patrimonio_conferencia_itens i
    JOIN pendencias.patrimonio_ativos a ON a.id = i.ativo_id
    WHERE i.conferencia_id = $1::uuid
    ORDER BY a.numero_patrimonio
  `,
    [id],
  );
  return { conferencia: conf, itens: it.rows || [] };
}

export async function createConferencia(
  pool: Pool,
  body: Record<string, unknown>,
  username: string,
): Promise<{ ok: true; row: unknown } | { ok: false; error: string; status: number }> {
  const agencia = String(body.agencia || "").trim();
  if (!agencia) return { ok: false, error: "Agência obrigatória", status: 400 };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `
      INSERT INTO pendencias.patrimonio_conferencias (agencia, data_inicio, status, responsavel_conferencia, observacoes)
      VALUES ($1, coalesce($2::date, current_date), 'EM_ANDAMENTO', $3, $4)
      RETURNING *
    `,
      [agencia, body.data_inicio || null, body.responsavel_conferencia ? String(body.responsavel_conferencia) : null, body.observacoes ? String(body.observacoes) : null],
    );
    const conf = ins.rows?.[0];
    const ativos = await client.query(
      `
      SELECT id FROM pendencias.patrimonio_ativos
      WHERE status <> 'BAIXADO' AND trim(coalesce(agencia_atual,'')) = $1
    `,
      [agencia],
    );
    for (const row of ativos.rows || []) {
      await client.query(
        `INSERT INTO pendencias.patrimonio_conferencia_itens (conferencia_id, ativo_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT (conferencia_id, ativo_id) DO NOTHING`,
        [conf.id, row.id],
      );
    }
    await client.query("COMMIT");
    return { ok: true, row: conf };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function patchConferenciaItem(
  pool: Pool,
  itemId: string,
  body: Record<string, unknown>,
  username: string,
) {
  const r = await pool.query(
    `
    UPDATE pendencias.patrimonio_conferencia_itens SET
      encontrado = coalesce($2::boolean, encontrado),
      estado_conservacao = coalesce($3, estado_conservacao),
      observacoes = coalesce($4, observacoes),
      conferido_em = CASE WHEN $2::boolean IS TRUE THEN now() ELSE conferido_em END,
      usuario = $5
    WHERE id = $1::uuid
    RETURNING *
  `,
    [
      itemId,
      body.encontrado !== undefined ? Boolean(body.encontrado) : null,
      body.estado_conservacao ? String(body.estado_conservacao) : null,
      body.observacoes ? String(body.observacoes) : null,
      username,
    ],
  );
  return r.rows?.[0] || null;
}

export async function finalizarConferencia(pool: Pool, id: string) {
  const r = await pool.query(
    `
    UPDATE pendencias.patrimonio_conferencias SET
      status = 'FINALIZADA',
      data_fim = current_date
    WHERE id = $1::uuid AND status <> 'CANCELADA'
    RETURNING *
  `,
    [id],
  );
  return r.rows?.[0] || null;
}

export async function listCategorias(pool: Pool) {
  const r = await pool.query(`SELECT * FROM pendencias.patrimonio_categorias WHERE ativa IS NOT FALSE ORDER BY nome`);
  return r.rows || [];
}

export async function listCentrosCusto(pool: Pool) {
  const r = await pool.query(`SELECT * FROM pendencias.patrimonio_centros_custo ORDER BY nome`);
  return r.rows || [];
}

export async function upsertCentroCusto(pool: Pool, body: Record<string, unknown>) {
  const id = body.id ? String(body.id) : null;
  if (id) {
    const r = await pool.query(
      `UPDATE pendencias.patrimonio_centros_custo SET nome = $2, agencia = $3, ativo = coalesce($4, ativo) WHERE id = $1::uuid RETURNING *`,
      [id, String(body.nome || "").trim(), body.agencia ? String(body.agencia) : null, body.ativo],
    );
    return r.rows?.[0] || null;
  }
  const r = await pool.query(
    `INSERT INTO pendencias.patrimonio_centros_custo (nome, agencia) VALUES ($1, $2) RETURNING *`,
    [String(body.nome || "").trim(), body.agencia ? String(body.agencia) : null],
  );
  return r.rows?.[0] || null;
}

export async function listResponsaveis(pool: Pool) {
  const r = await pool.query(`SELECT * FROM pendencias.patrimonio_responsaveis ORDER BY nome`);
  return r.rows || [];
}

export async function upsertResponsavel(pool: Pool, body: Record<string, unknown>) {
  const id = body.id ? String(body.id) : null;
  if (id) {
    const r = await pool.query(
      `UPDATE pendencias.patrimonio_responsaveis SET nome = $2, email = $3, agencia = $4, ativo = coalesce($5, ativo) WHERE id = $1::uuid RETURNING *`,
      [id, String(body.nome || "").trim(), body.email ? String(body.email) : null, body.agencia ? String(body.agencia) : null, body.ativo],
    );
    return r.rows?.[0] || null;
  }
  const r = await pool.query(
    `INSERT INTO pendencias.patrimonio_responsaveis (nome, email, agencia) VALUES ($1, $2, $3) RETURNING *`,
    [String(body.nome || "").trim(), body.email ? String(body.email) : null, body.agencia ? String(body.agencia) : null],
  );
  return r.rows?.[0] || null;
}

export async function listAgenciasLookup(pool: Pool): Promise<string[]> {
  try {
    const r = await pool.query(
      `SELECT DISTINCT trim(name) AS nome FROM pendencias.crm_agencies WHERE is_active IS NOT FALSE AND trim(coalesce(name,'')) <> '' ORDER BY 1 LIMIT 500`,
    );
    return (r.rows || []).map((x: { nome: string }) => x.nome).filter(Boolean);
  } catch {
    return [];
  }
}
