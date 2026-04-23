# Contexto para o agente (CRM / WhatsApp)

Pasta para notas curtas ao trabalhar neste repositório. **Não colar aqui dumps completos de logs** (JSONL do Vercel, etc.): isso polui o Git e mistura dados sensíveis. Para análise de produção, exporte os logs para um ficheiro local fora do repositório ou use o dashboard da Vercel.

## Resumo operacional (incidentes comuns)

| Sintoma | Causa provável | Ação |
|--------|----------------|------|
| Mídia Meta presa em “downloading” | Ingestão assíncrona cortada no serverless | Webhook Meta aguarda ingestão; `maxDuration` no route |
| Evolution 401 no webhook | `EVOLUTION_WEBHOOK_TOKEN` ≠ token na URL do webhook | Alinhar env na Vercel com URL na Evolution |
| Evolution `sendMedia` HTTP **413** | Corpo JSON (base64) maior que o limite do proxy/servidor Evolution | Transcodificar áudio para Ogg/Opus antes do envio; ou aumentar `client_max_body_size` no Nginx da Evolution |
| Upload CRM 400 “MIME não permitido” | Lista na BD + tipo com `;codecs=…` | Comparação por MIME base + união com defaults em `crm_media_settings` |

## Ficheiros úteis

- Webhook Meta: `app/api/whatsapp/webhook/route.ts`
- Webhook Evolution: `app/api/whatsapp/evolution/webhook/route.ts`
- Upload mídia CRM: `app/api/crm/media/upload/route.ts`
- Envio mensagem + Evolution: `app/api/crm/messages/route.ts`
- Limites MIME: `lib/server/crmMediaSettings.ts`
