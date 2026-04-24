# Validacao SQL — Visao Geral Operacional

Objetivo: confirmar o contrato oficial da tela de Visao Geral:

- total distinto por `CTE + serie` (sem concluidos)
- valores monetarios sem inflacao por parse
- contagens por fila coerentes com o backend

## 1) Base canonica (1 linha por CTE+serie)

```sql
WITH base_raw AS (
  SELECT
    c.cte,
    c.serie,
    COALESCE(i.view, 'pendencias') AS idx_view,
    COALESCE(i.status_calculado, c.status) AS status_calculado,
    c.status,
    c.valor_cte::text AS valor_raw,
    ROW_NUMBER() OVER (
      PARTITION BY c.cte, c.serie
      ORDER BY
        CASE
          WHEN COALESCE(i.view, '') = 'criticos' THEN 1
          WHEN COALESCE(i.view, '') IN ('ocorrencias', 'tad') THEN 2
          WHEN COALESCE(i.view, '') = 'em_busca' THEN 3
          WHEN COALESCE(i.view, '') = 'pendencias' THEN 4
          ELSE 5
        END,
        c.data_emissao DESC
    ) AS rn
  FROM pendencias.ctes c
  LEFT JOIN pendencias.cte_view_index i
    ON i.cte = c.cte
   AND (i.serie = c.serie OR ltrim(i.serie, '0') = ltrim(c.serie, '0'))
  WHERE
    (
      TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
      IN ('FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHA', 'NO PRAZO')
      OR TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
      LIKE 'CRITICO%'
      OR COALESCE(i.view, '') IN ('criticos', 'em_busca', 'ocorrencias', 'tad')
    )
    AND TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') NOT LIKE 'CONCLUIDO%'
    AND TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') NOT LIKE 'RESOLVIDO%'
    AND TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') NOT LIKE 'ENTREGUE%'
    AND TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') NOT LIKE 'CANCELADO%'
),
base AS (
  SELECT * FROM base_raw WHERE rn = 1
),
classified AS (
  SELECT
    cte,
    serie,
    CASE
      WHEN idx_view IN ('ocorrencias', 'tad') THEN 'ocorrencias'
      WHEN idx_view = 'em_busca' THEN 'em_busca'
      WHEN idx_view = 'criticos' THEN 'criticos'
      WHEN TRANSLATE(UPPER(COALESCE(status_calculado, status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') LIKE 'CRITICO%' THEN 'criticos'
      ELSE 'pendencias'
    END AS view_final,
    CASE
      WHEN valor_raw ~ '^-?\\d{1,3}(\\.\\d{3})*,\\d+$'
        THEN replace(replace(valor_raw, '.', ''), ',', '.')::numeric
      WHEN valor_raw ~ '^-?\\d+,\\d+$'
        THEN replace(valor_raw, ',', '.')::numeric
      WHEN valor_raw ~ '^-?\\d+(\\.\\d+)?$'
        THEN valor_raw::numeric
      ELSE 0::numeric
    END AS valor_num
  FROM base
)
SELECT
  view_final,
  COUNT(*) AS qtd_cte_serie,
  SUM(valor_num) AS valor_total
FROM classified
GROUP BY view_final
ORDER BY view_final;
```

## 2) Auditoria de duplicidade no indice

```sql
SELECT
  cte,
  ltrim(serie, '0') AS serie_norm,
  COUNT(*) AS qtd_linhas
FROM pendencias.cte_view_index
GROUP BY cte, ltrim(serie, '0')
HAVING COUNT(*) > 1
ORDER BY qtd_linhas DESC, cte;
```

## 3) Teste do parser monetario (front antigo vs parser robusto)

```sql
WITH vals AS (
  SELECT cte, serie, valor_cte::text AS valor_raw
  FROM pendencias.ctes
),
calc AS (
  SELECT
    cte,
    serie,
    valor_raw,
    COALESCE(NULLIF(replace(regexp_replace(valor_raw, '[^\\d,-]', '', 'g'), ',', '.'), ''), '0')::numeric AS valor_front_antigo,
    CASE
      WHEN valor_raw ~ '^-?\\d{1,3}(\\.\\d{3})*,\\d+$'
        THEN replace(replace(valor_raw, '.', ''), ',', '.')::numeric
      WHEN valor_raw ~ '^-?\\d+,\\d+$'
        THEN replace(valor_raw, ',', '.')::numeric
      WHEN valor_raw ~ '^-?\\d+(\\.\\d+)?$'
        THEN valor_raw::numeric
      ELSE 0::numeric
    END AS valor_correto
  FROM vals
)
SELECT
  COUNT(*) FILTER (WHERE valor_front_antigo <> valor_correto) AS linhas_divergentes,
  SUM(valor_front_antigo) AS soma_front_antigo,
  SUM(valor_correto) AS soma_correta
FROM calc;
```

