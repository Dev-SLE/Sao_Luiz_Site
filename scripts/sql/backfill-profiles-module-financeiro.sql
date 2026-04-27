-- Adiciona module.financeiro.view a perfis que já tinham a aba legada do setor Financeiro no Gerencial.
-- Executar no Neon/psql após deploy, se preferir migração manual (o servidor também aplica no login / GET perfis).
-- Ajuste se a coluna permissions não for text[] (ex.: jsonb — use o backfill via API ou converta o tipo).

UPDATE pendencias.profiles
SET
  permissions = permissions || ARRAY['module.financeiro.view']::text[],
  updated_at = NOW()
WHERE permissions && ARRAY['tab.gerencial.setor.financeiro.view']::text[]
  AND NOT (permissions && ARRAY['module.financeiro.view']::text[]);
