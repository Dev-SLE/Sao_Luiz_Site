# Mídia CRM (inbound / outbound)

## Inbound (cliente → CRM)

1. Webhook grava `crm_messages` (`body`, `metadata.raw`, `has_attachments`).
2. `ingestEvolutionInboundMedia` (async) cria linhas em `crm_message_media` e chama Evolution `getBase64` → SharePoint → `processing_status = STORED`.

Se o passo 1 corre mas o **2 nunca dispara** (sem `[crm-media] evolution_detected`), o problema pode estar **antes** do ingest: returns no `POST` do webhook (ex.: branch de QR a tratar base64 de imagem como QR). Ver [playbook-debug-webhook-midia-2026-04.md](../evolution/playbook-debug-webhook-midia-2026-04.md).

Tabelas: `pendencias.crm_message_media`, ficheiros no catálogo com `entity = whatsapp_media`.

## Outbound (CRM → WhatsApp)

- Evolution: `evolutionSendMedia`, `evolutionSendWhatsAppAudio`, `evolutionSendText` em `lib/server/evolutionClient.ts`
- Rota: `app/api/crm/messages/route.ts` (POST)

## Graph / upload (anexos do agente no chat)

Cliente: `lib/client/crmMediaGraphChunkUpload.ts` — upload monolítico até limite Graph, etc.

## Documentação SharePoint no repo

Ver `docs/CONFIGURACAO_SHAREPOINT.md`.
