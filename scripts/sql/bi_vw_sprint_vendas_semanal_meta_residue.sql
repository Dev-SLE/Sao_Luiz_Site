-- Ajuste: meta semanal por semana (arredondada em 2 casas) + resíduo na última semana do mês
-- para soma(meta_semanal_est) = meta_mensal por vendedora/mês.
-- Status e prêmio semanal passam a usar meta_semanal_est (já ajustada).
--
-- Aplicar no banco comercial (schema bi). Ordem: esta view primeiro; dependentes
-- (vw_sprint_vendas_tabela, vw_sprint_vendas_mensal) permanecem válidos com CREATE OR REPLACE.

CREATE OR REPLACE VIEW bi.vw_sprint_vendas_semanal AS
WITH vendas_semana AS (
  SELECT
    b.mes_referencia,
    b.vendedor,
    b.semana_mes_ordem,
    count(DISTINCT b.id_unico_nf) AS qtd_notas,
    COALESCE(sum(b.valor_venda_auditada), 0::numeric)::numeric(15, 2) AS venda_auditada_semana
  FROM bi.vw_sprint_vendas_base b
  GROUP BY b.mes_referencia, b.vendedor, b.semana_mes_ordem
),
graded AS (
  SELECT
    g.mes_referencia,
    g.vendedor,
    g.meta_mensal,
    g.premio_total,
    g.semana_mes_ordem,
    g.semana_mes_label,
    g.inicio_semana_no_mes,
    g.fim_semana_no_mes,
    g.dias_uteis_mes,
    g.dias_uteis_semana,
    g.qtd_semanas_mes,
    COALESCE(v.qtd_notas, 0::bigint) AS qtd_notas,
    COALESCE(v.venda_auditada_semana, 0::numeric)::numeric(15, 2) AS venda_auditada_semana,
    (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric)::numeric(15, 2) AS meta_diaria_base,
    ROUND(
      (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric) * g.dias_uteis_semana::numeric,
      2
    ) AS meta_semanal_parcela_rounded,
    MAX(g.semana_mes_ordem) OVER (PARTITION BY g.mes_referencia, g.vendedor) AS max_semana_ordem
  FROM bi.vw_sprint_vendas_grade_semanal g
  LEFT JOIN vendas_semana v
    ON v.mes_referencia = g.mes_referencia
   AND v.vendedor = g.vendedor
   AND v.semana_mes_ordem = g.semana_mes_ordem
),
with_prev_sum AS (
  SELECT
    *,
    SUM(meta_semanal_parcela_rounded) OVER (
      PARTITION BY mes_referencia, vendedor
      ORDER BY semana_mes_ordem
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS soma_arredondadas_anteriores
  FROM graded
),
meta_calc AS (
  SELECT
    mes_referencia,
    vendedor,
    meta_mensal,
    premio_total,
    semana_mes_ordem,
    semana_mes_label,
    inicio_semana_no_mes,
    fim_semana_no_mes,
    dias_uteis_mes,
    dias_uteis_semana,
    qtd_semanas_mes,
    qtd_notas,
    venda_auditada_semana,
    meta_diaria_base,
    (
      CASE
        WHEN semana_mes_ordem = max_semana_ordem THEN
          (meta_mensal - COALESCE(soma_arredondadas_anteriores, 0::numeric))::numeric(15, 2)
        ELSE meta_semanal_parcela_rounded::numeric(15, 2)
      END
    ) AS meta_semanal_est
  FROM with_prev_sum
)
SELECT
  m.mes_referencia,
  m.vendedor,
  m.meta_mensal,
  m.premio_total,
  m.semana_mes_ordem,
  m.semana_mes_label,
  m.inicio_semana_no_mes,
  m.fim_semana_no_mes,
  m.dias_uteis_mes,
  m.dias_uteis_semana,
  m.qtd_semanas_mes,
  m.qtd_notas,
  m.venda_auditada_semana,
  m.meta_diaria_base,
  m.meta_semanal_est,
  (m.premio_total / NULLIF(m.qtd_semanas_mes, 0)::numeric)::numeric(15, 2) AS premio_por_semana,
  CASE
    WHEN COALESCE(m.venda_auditada_semana, 0::numeric) >= m.meta_semanal_est
     AND m.meta_semanal_est > 0::numeric
    THEN (m.premio_total / NULLIF(m.qtd_semanas_mes, 0)::numeric)::numeric(15, 2)
    ELSE 0::numeric(15, 2)
  END AS premio_garantido_semana,
  CASE
    WHEN m.meta_semanal_est <= 0::numeric THEN NULL::text
    WHEN m.fim_semana_no_mes > CURRENT_DATE
     AND COALESCE(m.venda_auditada_semana, 0::numeric) = 0::numeric THEN NULL::text
    WHEN COALESCE(m.venda_auditada_semana, 0::numeric) >= m.meta_semanal_est THEN '🏆'::text
    ELSE '❌'::text
  END AS status_semana
FROM meta_calc m;
