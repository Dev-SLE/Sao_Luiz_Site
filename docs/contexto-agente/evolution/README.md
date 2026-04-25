# Evolution × CRM

Notas sobre a integração **Evolution API v2** (WhatsApp) com o site Pendencias.

## Notas

- [[erros-e-diagnostico]] — tabela sintoma → causa → ação
- [[playbook-debug-webhook-midia-2026-04]] — **mídia no payload, 200, mas sem upsert/ingest** (QR falso positivo, logs Vercel, checklist)
- [[getBase64-e-midia]] — como o CRM baixa mídia e o que a Evolution espera
- [[persistencia-database]] — quando `DATABASE_SAVE_*` importa (servidor Evolution, não Vercel)
- [[webhook-crm]] — rota Next.js, eventos, 401, ordem de branches

## Fluxo resumido

1. Evolution recebe mensagem WA → envia webhook para `POST /api/whatsapp/evolution/webhook`.
2. O CRM grava `crm_messages` e dispara `ingestEvolutionInboundMedia`.
3. Ingest chama `POST .../chat/getBase64FromMediaMessage/{instance}` → bytes → SharePoint → `crm_message_media`.

Se o passo 3 falha, a UI pode mostrar `reachability:...` e o SharePoint fica sem ficheiro novo.
