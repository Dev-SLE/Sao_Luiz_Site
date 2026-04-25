# Plano de normalização de mídia (CRM / Evolution)

Especificação de produto para o tratamento de mídias recebidas no chat CRM via WhatsApp/Evolution.

## Contexto

- O sistema já tem banco Neon funcionando.
- As mídias são salvas no SharePoint.
- Não inclui transcrição de áudio (fora de escopo por agora).
- Problema corrigido: nomes quebrados como `evo_[object Object].jpg` quando um objeto bruto era convertido para string na montagem do nome.

Também existem mensagens com estruturas como:

- `imageMessage`
- `audioMessage`
- `documentMessage`
- `videoMessage`
- `base64`

## Objetivo

Uma camada única de normalização de mídia antes de gravar no Neon e antes de renderizar no CRM.

## Regras principais

1. Nunca usar objeto bruto para montar nome de ficheiro.
2. Nunca salvar/renderizar `[object Object]` como nome.
3. Detetar corretamente o tipo da mídia recebida.
4. Extrair `mimeType`, extensão, nome original quando existir e base64 quando existir.
5. Salvar o ficheiro no SharePoint com nome seguro.
6. Gravar no Neon metadados padronizados e o identificador do ficheiro no SharePoint (ver implementação em `lib/server/crmMediaNormalize.ts` e `lib/server/crmMediaIngest.ts`).
7. O frontend deve preferir o modelo padronizado, com fallback para linhas antigas (ver `app/api/crm/messages/route.ts` e `components/crm/CrmMessageAttachments.tsx`).
8. Não implementar transcrição de áudio neste plano.

## Modelo padronizado no `metadata_json` (campo `normalized`)

```json
{
  "tipo": "image | audio | video | document | unknown",
  "storage_provider": "sharepoint",
  "storage_path": "caminho/id do ficheiro no SharePoint",
  "file_catalog_id": "id no catálogo de ficheiros",
  "nome_arquivo": "evo_20260424_203012_xxxxx.jpg",
  "nome_original": "quando existir",
  "mime_type": "image/jpeg",
  "extensao": "jpg",
  "tamanho_bytes": 123456
}
```

Nota: a URL assinada ou pública para download é resolvida pela API a partir do catálogo / SharePoint; não duplicar URL longa no JSON se já existir fluxo via `file_catalog_id`.

## Funções centrais (implementação)

- `safeMediaString`, `evolutionBlockStableId`, `buildSafeEvolutionUploadFileName`, `displayFilenameForAttachment`, etc. em `lib/server/crmMediaNormalize.ts`.
- Ingest Evolution e Meta em `lib/server/crmMediaIngest.ts` (inclui `metadataPatch.normalized` ao concluir upload).

## Fluxo de salvamento

1. Receber mensagem da Evolution / Meta.
2. Normalizar mídia (slots, chaves, nomes).
3. Se houver mídia e base64: converter para buffer, enviar SharePoint, receber path/id.
4. Gravar no Neon com metadados padronizados.
5. Se não houver mídia: gravar mensagem de texto normal.
6. Se falhar o upload: estado `upload_failed`, erro técnico em log, sem quebrar o fluxo do chat.

## Frontend

- Preferir campos canónicos / `normalized` quando existirem.
- Imagem: preview; áudio: player; documento: nome + link; vídeo: player ou link.
- `upload_failed`: mensagem do tipo «Mídia recebida; falha ao carregar…».
- Nunca exibir `evo_[object Object].jpg` — nomes corruptos são substituídos no servidor e na API.

## Logs úteis (operacionais)

- Deteção: tipo, mime, extensão, se tem base64, nome final gerado.
- Upload SharePoint: path/id.
- Neon: id da mensagem, metadados normalizados.
- Nome inválido: `warning` e nome seguro gerado.

## Documentação relacionada

- Fluxo inbound/outbound: `docs/contexto-agente/crm/midia-inbound-outbound.md` (se existir na cópia local).
