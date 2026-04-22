-- Desempenho Agências (fase_8): base analítica em tb_nf_saidas_consolidada, schema bi.
-- Executar na base comercial (mesmo host que COMERCIAL_DATABASE_URL).

CREATE SCHEMA IF NOT EXISTS bi;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_base AS
SELECT
  n.id_unico,
  n.data_emissao::date AS data_referencia,
  date_trunc('month', n.data_emissao::timestamp)::date AS mes_referencia,
  trim(COALESCE(n.coleta, '')) AS agencia_origem,
  trim(COALESCE(n.entrega, '')) AS agencia_destino,
  trim(COALESCE(n.rota, '')) AS rota,
  trim(COALESCE(n.tipo_frete, '')) AS tipo_frete,
  COALESCE(n.volumes, 0)::bigint AS volumes,
  COALESCE(n.peso, 0)::numeric AS peso,
  COALESCE(n.valor_total, 0)::numeric AS valor_total,
  CASE WHEN COALESCE(n.tx_coleta, 0::numeric) > 0 THEN 1 ELSE 0 END::integer AS flg_coleta,
  CASE WHEN COALESCE(n.tx_entrega, 0::numeric) > 0 THEN 1 ELSE 0 END::integer AS flg_entrega,
  CASE WHEN COALESCE(n.numero_mfde, 0::bigint) > 0 THEN 1 ELSE 0 END::integer AS flg_manifesto
FROM tb_nf_saidas_consolidada n
WHERE n.status_sistema = 'AUTORIZADA'::text
  AND n.data_emissao IS NOT NULL;

-- Combinações observadas para filtros (facets).
CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_filters AS
SELECT DISTINCT
  trim(COALESCE(b.agencia_origem, '')) AS agencia_origem,
  trim(COALESCE(b.agencia_destino, '')) AS agencia_destino,
  trim(COALESCE(b.rota, '')) AS rota,
  trim(COALESCE(b.tipo_frete, '')) AS tipo_frete
FROM bi.vw_desempenho_agencias_base b;

-- Grão operacional por CTE (alias para KPIs filtrados na API).
CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_kpis AS
SELECT * FROM bi.vw_desempenho_agencias_base;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_evolucao_mensal AS
SELECT
  b.mes_referencia,
  count(*)::bigint AS total_ctes,
  COALESCE(sum(b.volumes), 0)::bigint AS total_volumes,
  COALESCE(sum(b.peso), 0)::numeric AS peso_total,
  COALESCE(sum(b.valor_total), 0)::numeric AS faturamento_total
FROM bi.vw_desempenho_agencias_base b
GROUP BY b.mes_referencia;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_origem AS
SELECT
  b.agencia_origem AS agencia,
  count(*)::bigint AS total_ctes_origem,
  COALESCE(sum(b.volumes), 0)::bigint AS total_volumes_origem,
  COALESCE(sum(b.peso), 0)::numeric AS peso_total_origem,
  COALESCE(sum(b.valor_total), 0)::numeric AS faturamento_origem,
  COALESCE(sum(b.flg_coleta), 0)::bigint AS qtd_coletas,
  COALESCE(sum(b.flg_entrega), 0)::bigint AS qtd_entregas,
  COALESCE(sum(b.flg_manifesto), 0)::bigint AS qtd_manifestos
FROM bi.vw_desempenho_agencias_base b
WHERE trim(COALESCE(b.agencia_origem, '')) <> ''
GROUP BY b.agencia_origem;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_destino AS
SELECT
  b.agencia_destino AS agencia,
  count(*)::bigint AS total_ctes_destino,
  COALESCE(sum(b.volumes), 0)::bigint AS total_volumes_destino,
  COALESCE(sum(b.peso), 0)::numeric AS peso_total_destino,
  COALESCE(sum(b.valor_total), 0)::numeric AS faturamento_destino
FROM bi.vw_desempenho_agencias_base b
WHERE trim(COALESCE(b.agencia_destino, '')) <> ''
GROUP BY b.agencia_destino;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_matriz AS
SELECT
  COALESCE(o.agencia, d.agencia) AS agencia,
  COALESCE(o.total_ctes_origem, 0::bigint) AS total_ctes_origem,
  COALESCE(d.total_ctes_destino, 0::bigint) AS total_ctes_destino,
  COALESCE(o.total_volumes_origem, 0::bigint) AS total_volumes_origem,
  COALESCE(d.total_volumes_destino, 0::bigint) AS total_volumes_destino,
  (COALESCE(o.total_ctes_origem, 0::bigint) - COALESCE(d.total_ctes_destino, 0::bigint))::bigint AS saldo_ctes,
  (COALESCE(o.total_volumes_origem, 0::bigint) - COALESCE(d.total_volumes_destino, 0::bigint))::bigint AS saldo_volumes
FROM bi.vw_desempenho_agencias_origem o
FULL OUTER JOIN bi.vw_desempenho_agencias_destino d ON o.agencia = d.agencia;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_ranking AS
SELECT * FROM bi.vw_desempenho_agencias_origem;

CREATE OR REPLACE VIEW bi.vw_desempenho_agencias_drill AS
SELECT
  b.id_unico,
  b.data_referencia,
  b.mes_referencia,
  b.agencia_origem,
  b.agencia_destino,
  b.rota,
  b.tipo_frete,
  b.volumes,
  b.peso,
  b.valor_total,
  b.flg_coleta,
  b.flg_entrega,
  b.flg_manifesto
FROM bi.vw_desempenho_agencias_base b;
