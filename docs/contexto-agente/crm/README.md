# CRM (chat, mídia, Evolution)

## Notas

- [[midia-inbound-outbound]] — fluxo de anexos e ficheiros

## Rotas API relevantes

- `GET/POST /api/crm/messages` — histórico e envio
- `GET /api/crm/media-settings` — limites MIME / tamanhos
- `POST /api/whatsapp/evolution/webhook` — entrada WhatsApp Evolution (debug: [playbook-debug-webhook-midia-2026-04.md](../evolution/playbook-debug-webhook-midia-2026-04.md))

## UI

- `components/CrmChat.tsx` — lista de mensagens
- `components/crm/CrmMessageAttachments.tsx` — render de imagem, vídeo, áudio, sticker, falhas
