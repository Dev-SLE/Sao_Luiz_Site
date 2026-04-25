import { getPool } from "./db";

let patrimonioSchemaReady = false;
let patrimonioSchemaPromise: Promise<void> | null = null;

/** Tabelas e views do módulo Patrimônio (`pendencias` + `bi` para leitura analítica). */
export async function ensurePatrimonioSchemaTables() {
  if (patrimonioSchemaReady) return;
  if (patrimonioSchemaPromise) return patrimonioSchemaPromise;
  patrimonioSchemaPromise = (async () => {
    const pool = getPool();
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_categorias (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL UNIQUE,
        ativa boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_centros_custo (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL UNIQUE,
        agencia text,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_responsaveis (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL,
        email text,
        agencia text,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_ativos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        numero_patrimonio text NOT NULL UNIQUE,
        descricao text NOT NULL,
        categoria text NOT NULL,
        subcategoria text,
        marca text,
        modelo text,
        numero_serie text,
        estado_conservacao text,
        status text NOT NULL DEFAULT 'ATIVO',
        agencia_atual text,
        centro_custo text,
        responsavel_atual text,
        data_aquisicao date,
        valor_aquisicao numeric(15,2),
        fornecedor text,
        numero_nf text,
        observacoes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patrimonio_ativos_agencia ON pendencias.patrimonio_ativos (agencia_atual)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patrimonio_ativos_status ON pendencias.patrimonio_ativos (status)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patrimonio_ativos_categoria ON pendencias.patrimonio_ativos (categoria)`,
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_movimentacoes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ativo_id uuid NOT NULL REFERENCES pendencias.patrimonio_ativos(id) ON DELETE CASCADE,
        tipo_movimentacao text NOT NULL,
        agencia_origem text,
        agencia_destino text,
        centro_custo_origem text,
        centro_custo_destino text,
        responsavel_origem text,
        responsavel_destino text,
        data_movimentacao date NOT NULL DEFAULT CURRENT_DATE,
        motivo text,
        observacoes text,
        usuario text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patrimonio_mov_ativo ON pendencias.patrimonio_movimentacoes (ativo_id, created_at DESC)`,
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_manutencoes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ativo_id uuid NOT NULL REFERENCES pendencias.patrimonio_ativos(id) ON DELETE CASCADE,
        data_abertura date NOT NULL DEFAULT CURRENT_DATE,
        data_prevista_retorno date,
        data_fechamento date,
        tipo_manutencao text,
        descricao_problema text NOT NULL,
        fornecedor_servico text,
        custo_estimado numeric(15,2),
        custo_final numeric(15,2),
        status text NOT NULL DEFAULT 'ABERTA',
        observacoes text,
        usuario text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patrimonio_manut_ativo ON pendencias.patrimonio_manutencoes (ativo_id, created_at DESC)`,
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_baixas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ativo_id uuid NOT NULL REFERENCES pendencias.patrimonio_ativos(id) ON DELETE CASCADE,
        data_baixa date NOT NULL DEFAULT CURRENT_DATE,
        motivo_baixa text NOT NULL,
        valor_residual numeric(15,2),
        destino_final text,
        aprovado_por text,
        observacoes text,
        usuario text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_patrimonio_baixa_ativo ON pendencias.patrimonio_baixas (ativo_id)`,
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_conferencias (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agencia text NOT NULL,
        data_inicio date NOT NULL DEFAULT CURRENT_DATE,
        data_fim date,
        status text NOT NULL DEFAULT 'ABERTA',
        responsavel_conferencia text,
        observacoes text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pendencias.patrimonio_conferencia_itens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conferencia_id uuid NOT NULL REFERENCES pendencias.patrimonio_conferencias(id) ON DELETE CASCADE,
        ativo_id uuid NOT NULL REFERENCES pendencias.patrimonio_ativos(id) ON DELETE CASCADE,
        encontrado boolean NOT NULL DEFAULT false,
        estado_conservacao text,
        observacoes text,
        conferido_em timestamptz,
        usuario text,
        UNIQUE (conferencia_id, ativo_id)
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patrimonio_conf_item_conf ON pendencias.patrimonio_conferencia_itens (conferencia_id)`,
    );

    await pool.query(`
      INSERT INTO pendencias.patrimonio_categorias (nome, ativa)
      VALUES
        ('TI', true),
        ('MÓVEIS', true),
        ('EQUIPAMENTOS', true),
        ('VEÍCULOS', true),
        ('OPERACIONAL', true),
        ('FERRAMENTAS', true),
        ('OUTROS', true)
      ON CONFLICT (nome) DO NOTHING
    `);

    await pool.query(`CREATE SCHEMA IF NOT EXISTS bi`);

    await pool.query(`
      CREATE OR REPLACE VIEW bi.vw_patrimonio_base AS
      SELECT
        a.id,
        a.numero_patrimonio,
        a.descricao,
        a.status,
        a.categoria,
        a.agencia_atual,
        a.centro_custo,
        a.responsavel_atual,
        a.valor_aquisicao,
        a.data_aquisicao,
        (SELECT m.created_at FROM pendencias.patrimonio_movimentacoes m WHERE m.ativo_id = a.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_movimentacao,
        (SELECT m2.created_at FROM pendencias.patrimonio_manutencoes m2 WHERE m2.ativo_id = a.id ORDER BY m2.created_at DESC LIMIT 1) AS ultima_manutencao,
        (SELECT b.created_at FROM pendencias.patrimonio_baixas b WHERE b.ativo_id = a.id LIMIT 1) AS data_baixa
      FROM pendencias.patrimonio_ativos a
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW bi.vw_patrimonio_kpis AS
      SELECT
        count(*)::bigint AS total_ativos,
        coalesce(sum(valor_aquisicao), 0)::numeric(15,2) AS valor_total_aquisicao,
        count(*) FILTER (WHERE status = 'ATIVO')::bigint AS ativos_ativos,
        count(*) FILTER (WHERE status = 'EM_MANUTENCAO')::bigint AS ativos_em_manutencao,
        count(*) FILTER (WHERE status = 'BAIXADO')::bigint AS ativos_baixados,
        count(*) FILTER (WHERE status <> 'BAIXADO' AND (responsavel_atual IS NULL OR trim(responsavel_atual) = ''))::bigint AS ativos_sem_responsavel,
        count(*) FILTER (WHERE status <> 'BAIXADO' AND (agencia_atual IS NULL OR trim(agencia_atual) = ''))::bigint AS ativos_sem_agencia
      FROM pendencias.patrimonio_ativos
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW bi.vw_patrimonio_por_agencia AS
      SELECT
        coalesce(nullif(trim(agencia_atual), ''), '(sem agência)') AS agencia,
        count(*)::bigint AS total_ativos,
        coalesce(sum(valor_aquisicao), 0)::numeric(15,2) AS valor_total,
        count(*) FILTER (WHERE status = 'EM_MANUTENCAO')::bigint AS em_manutencao,
        count(*) FILTER (WHERE status = 'BAIXADO')::bigint AS baixados
      FROM pendencias.patrimonio_ativos
      GROUP BY 1
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW bi.vw_patrimonio_por_categoria AS
      SELECT
        categoria,
        count(*)::bigint AS total_ativos,
        coalesce(sum(valor_aquisicao), 0)::numeric(15,2) AS valor_total,
        count(*) FILTER (WHERE status = 'ATIVO')::bigint AS ativos_ativos,
        count(*) FILTER (WHERE status = 'EM_MANUTENCAO')::bigint AS em_manutencao,
        count(*) FILTER (WHERE status = 'BAIXADO')::bigint AS baixados
      FROM pendencias.patrimonio_ativos
      GROUP BY categoria
    `);
  })();
  try {
    await patrimonioSchemaPromise;
    patrimonioSchemaReady = true;
  } finally {
    patrimonioSchemaPromise = null;
  }
}
