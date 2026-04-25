# Webhook Evolution → CRM (Pendencias)

## Rota

`POST /api/whatsapp/evolution/webhook`

Código: `app/api/whatsapp/evolution/webhook/route.ts`

## Payload típico (v2)

Corpo com `event`, `instance`, `data`, …

Objeto **`data`** (mensagem) costuma ter:

- `key` — `remoteJid`, `fromMe`, `id`
- `message` — nós Baileys (pode vir vazio numa fase e enriquecer depois)
- `messageType` — string na **raiz** de `data` (ex.: `stickerMessage`, `imageMessage`, `audioMessage`)
- `messageTimestamp`, `pushName`, …

O CRM usa `messageType` na raiz quando o `message` ainda é stub — ver `evolutionWebhookRootMessageType`, `bodyTextFromEvolutionMessageTypeHint`, `duplicate_message_enriched`.

## Eventos

- `messages.upsert` — principal para gravar mensagens e disparar ingest de mídia
- Outros (`connection.update`, …) — QR, estado; ver logs `[evolution-webhook]`

## Diagnóstico 401

Se no Vercel aparecer **401** no mesmo path do webhook noutros `requestId`:

- Verificar se a Evolution envia sempre o header/secret esperado pelo projeto (middleware / route).
- Comparar com pedidos **200** no mesmo intervalo (duplicados, health check, etc.).

---

## Ordem do `POST` após auth (mental model)

1. Logs de entrada / corpo (`route_post_entry_always`, `after_req_text_always`, `route_body_parsed_always`, …).
2. QR por **evento** (`qrcode.updated`, …).
3. QR por **payload** (`evolutionQrCaptureFromWebhook`) — **só se o pedido não for `messages.upsert`** (`isUpsertRoute`), para não confundir base64 de `imageMessage` com QR.
4. `messages.edited` / delete / `messages.update`.
5. **`messages.upsert`** → schema, pool, inbox, `collectUpsertItemsFromWebhookBody`, `defaultIds`, loop.

Se o diag mostra mídia mas **não** há `upsert_gate_probe_always`, o corte está quase sempre **antes do passo 5** (passo 3 foi o caso crítico em abr. 2026).

## Playbook detalhado (incidente mídia vs upsert)

Ver [playbook-debug-webhook-midia-2026-04.md](playbook-debug-webhook-midia-2026-04.md) — checklist, causa raiz (QR falso positivo), strings de log para pesquisar no Vercel.
