-- Neon: backup antes. Um único bloco — copie tudo entre BEGIN e COMMIT (inclusive).
-- Por omissão: apaga dados de teste CRM e alinha evolution_server_url à API HTTPS pública.
-- Para também apagar linhas de inbox Evolution, descomente o DELETE final antes do COMMIT.

BEGIN;

DELETE FROM pendencias.crm_tasks;
DELETE FROM pendencias.crm_leads;
DELETE FROM pendencias.crm_consent_events;
DELETE FROM pendencias.crm_contact_prefs;
DELETE FROM pendencias.crm_campaigns;

UPDATE pendencias.crm_whatsapp_inboxes
SET
  evolution_server_url = regexp_replace(btrim('https://evo.seudominio.com.br'), '/+$', ''),
  updated_at = NOW()
WHERE provider = 'EVOLUTION';

UPDATE pendencias.crm_evolution_intake_settings
SET
  lead_filter_mode = 'BUSINESS_ONLY',
  meta_lead_filter_mode = 'BUSINESS_ONLY',
  ai_enabled = true,
  meta_ai_enabled = true,
  min_messages_before_create = 2,
  meta_min_messages_before_create = 1,
  allowlist_last10 = NULL,
  denylist_last10 = NULL,
  updated_at = NOW()
WHERE id = 1;

-- Opcional — wipe total das inboxes Evolution (e intake_buffer em CASCADE):
-- DELETE FROM pendencias.crm_whatsapp_inboxes WHERE provider = 'EVOLUTION';
-- Opcional — inbox Meta de laboratório:
-- DELETE FROM pendencias.crm_whatsapp_inboxes WHERE provider = 'META';

COMMIT;
