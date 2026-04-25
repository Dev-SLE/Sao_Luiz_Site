# getBase64 e mídia inbound (CRM)

## Endpoint Evolution

`POST /chat/getBase64FromMediaMessage/{instance}`

Header: `apikey`, `Content-Type: application/json`

Body (simplificado):

```json
{
  "message": { "key": { "remoteJid": "...", "fromMe": false, "id": "..." } },
  "convertToMp4": false
}
```

O DTO oficial (`getBase64FromMediaMessageDto`) espera um `proto.WebMessageInfo` — na prática `key` + opcionalmente `message` (nós `imageMessage`, `stickerMessage`, etc.).

## Comportamento interno (Evolution / Baileys)

Trecho lógico relevante (código fonte Evolution, `whatsapp.baileys.service.ts`):

1. `msg = m?.message ? m : await this.getMessage(m.key, true)`
   - Se **não** existir `message` no payload, a Evolution **lê da base** da instância.
   - Se existir `message`, usa **só** esse objeto (risco se o webhook for incompleto).

2. Depois desembrulha subtipos (`ephemeral`, `viewOnce`, …) e procura um tipo em `TypeMediaMessage`.

3. Se não achar mídia suportada → **`The message is not of the media type`**.

4. Download via `downloadMediaMessage` (ou fallback `downloadContentFromMessage`).

## O que o Pendencias faz

Ficheiro: `lib/server/evolutionClient.ts` — `evolutionGetBase64FromMediaMessage`

1. Estratégia **`key_only_db`**: `{ message: { key }, convertToMp4 }` — força reidratação.
2. Estratégia **`webhook_envelope`**: `{ message: { key, message: <nós do webhook> }, convertToMp4 }` — fallback.

Ingestão: `lib/server/crmMediaIngest.ts` — `ingestEvolutionInboundMedia` + `collectEvolutionMediaSlots` (sticker vs image, PTT vs áudio, etc.).

## SharePoint

Após base64 válido: upload em `modules/storage` / Graph; caminho inclui `crm`, ano, mês, `conversation_id`, `media_type`. Se getBase64 falha, **nada** é criado no drive.
