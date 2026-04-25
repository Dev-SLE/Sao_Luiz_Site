# Evolution — erros e diagnóstico

## Logs JSON (`scope: evolution`)

| `event` | Significado |
|---------|-------------|
| `getBase64_failed` | Evolution devolveu erro HTTP ou corpo sem base64 útil |
| `getBase64_ok` | Sucesso; campo `strategy`: `key_only_db` ou `webhook_envelope` |
| `fetch_failed` | Rede/timeout para a Evolution |

Procurar também `[evolution-webhook]` e `[crm-media]` no Vercel.

---

## Mensagem / sintoma → causa provável → o que fazer

### `The message is not of the media type` (400)

**Causa:** O handler da Evolution (`getBase64FromMediaMessage`) monta o `msg` a partir do body. Se o JSON traz `message.message` preenchido com um proto que **não** corresponde ao tipo real guardado no WA (ou espelho incompleto do webhook), a iteração sobre `TypeMediaMessage` falha e devolve este texto.

**No CRM (correção aplicada):** primeiro tenta-se body **só com `key`** para forçar `getMessage(key)` na BD da Evolution; depois fallback com envelope do webhook.

**Na Evolution:** garantir que a instância grava mensagens se quiseres depender do `key_only` — ver [[persistencia-database]].

---

### `Message not found` (getBase64)

**Causa:** `getMessage(key)` não encontrou a mensagem (BD desligada, mensagem ainda não persistida, ou ID/JID errados).

**Ação:** Persistência na Evolution; validar `key.id`, `remoteJid`, `fromMe`. Referência: [EvolutionAPI#1250](https://github.com/EvolutionAPI/evolution-api/issues/1250).

---

### Webhook `POST /api/whatsapp/evolution/webhook` com **401** (misturado com 200)

**Causa:** Alguns pedidos sem credencial válida (Evolution com URL errada, secret de webhook no middleware, ou chamadas duplicadas).

**Ação:** Comparar headers/body dos 401 com os 200; alinhar URL de webhook na Evolution com o que o Vercel espera (auth).

---

### `event_payload_diag` vê `imageMessage` / `audioMessage`, 200 OK, mas **não** há `upsert_gate_probe_always` nem `[crm-media]`

**Causa (caso real abr. 2026):** O branch genérico de **QR por payload** (`evolutionQrCaptureFromWebhook` + `deepFindQrBase64`) varria o JSON inteiro; base64 longo de mídia era tratado como QR → `return { qrStored: true }` **antes** do bloco `messages.upsert`.

**Correção:** Não correr esse QR por payload quando `looksLikeMessagesUpsert(body, eventNorm)`; e ignorar subárvores `imageMessage` / `audioMessage` / … no deep find (ver `lib/server/evolutionLastQr.ts`).

**Diagnóstico rápido:** Procurar `after_diag_before_upsert_branch_always` (`isUpsert: true`) e a seguir `before_crm_context_load_always`. Se `isUpsert` for true mas o fluxo parar, listar returns entre o diag e o upsert (QR, edit, update).

**Playbook:** [playbook-debug-webhook-midia-2026-04.md](playbook-debug-webhook-midia-2026-04.md)

---

### SharePoint `crm/AAAA/MM` vazio após mídia

**Causa:** Ingest falhou antes de `uploadFileToSharePoint` (getBase64, MIME não permitido, limite de tamanho, Graph).

**Ação:** Ver `crm_message_media.processing_status` = `FAILED` e `processing_error`; logs `getBase64_*` e `[crm-media]`.

---

### Figurinha mostra texto + erro `reachability:... not of the media type`

**Causa:** Combinado de placeholder no `body` + linha de mídia falhada (slot errado ou body antigo).

**No CRM:** ingest com prioridade sticker vs image duplicado; getBase64 key-only; UI esconde “fantasma” só em casos específicos (ver código `CrmMessageAttachments`).

---

### Áudio não aparece / PTT vs `audioMessage`

**Causa:** Baileys usa `audioMessage` com `ptt: true` e/ou `pttMessage`; pedir o tipo errado ao WA gera 400.

**No CRM:** slots exclusivos PTT vs áudio; remapeamento de proto conforme `messageType` na raiz do item.

---

## Comandos úteis (repo)

- `GET /api/diagnostics/evolution` — envs mascaradas, reachability raiz Evolution
- Script: `npm run check:evolution-media-reachability` (ver `package.json`)
