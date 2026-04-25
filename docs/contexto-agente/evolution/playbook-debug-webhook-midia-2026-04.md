# Playbook: webhook Evolution — mídia no payload mas CRM não upserta / não ingere

Incidente resolvido (abr. 2026). Serve para **encontrar o corte no fluxo** sem repetir dias de tentativa e erro.

## Sintoma típico

- `POST /api/whatsapp/evolution/webhook` com **200**.
- `event_payload_diag` (quando `CRM_EVOLUTION_WEBHOOK_EVENT_DIAG` está ligado) mostra `imageMessage` / `audioMessage` e `routesToCrmUpsert: true`.
- Corpo grande (`rawLen` na ordem dos centenas de KB) — base64 de mídia presente.
- **Não** aparecem: `upsert_gate_probe_always`, `upsert_ingest_gate`, `[crm-media] evolution_detected`, `evolution_download_start`, `evolution_stored`.

Conclusão aparente: “a mídia chega mas o gate/ingest não corre”. Pode ser **branch que retorna antes** do bloco `messages.upsert`, não só falha de `hasMedia`.

## Causa raiz (este incidente)

O branch **“QR capturado por payload”** (`evolutionQrCaptureFromWebhook` em `lib/server/evolutionLastQr.ts`) faz `deepFindQrBase64` em **todo** o JSON. Strings longas em base64 (mídia WhatsApp) batiam no heurístico de “parece QR” → `return { ok: true, qrStored: true }` **antes** de `looksLikeMessagesUpsert` / loop / ingest.

Correções no código:

1. **`route.ts`**: só corre o QR genérico por payload se **`!looksLikeMessagesUpsert(body, eventNorm)`** (variável `isUpsertRoute` calculada uma vez após o diag).
2. **`evolutionLastQr.ts`**: `deepFindQrBase64` **não desce** em subárvores cujo pai é `imageMessage`, `audioMessage`, `videoMessage`, `documentMessage`, `stickerMessage`, `pttMessage`, `ptvMessage`.

## Outras causas comuns (checklist rápido)

| Ordem | O que verificar | Onde / log |
|-------|-----------------|------------|
| 1 | Corpo lido e JSON válido | `route_post_entry_always` → `after_req_text_always` → `after_json_parse_always` → `route_body_parsed_always` |
| 2 | Auth | `unauthorized` + 401 antes de qualquer coisa |
| 3 | Evento tratado como outro handler | `after_diag_before_upsert_branch_always` → `isUpsert` false ⇒ `ignored_event` |
| 4 | QR / connect / edit / delete / update | `branch_return_always` ou returns sem passar por `before_crm_context_load_always` |
| 5 | Inbox ou pipeline | `after_crm_context_load_always` (`hasInbox`, `hasDefaultIds`) |
| 6 | Itens vazios | `after_items_build_always` com `count: 0` |
| 7 | Loop corta (grupo, broadcast, intake WAIT, duplicata) | `upsert_gate_probe_always` com `skipReason` |
| 8 | Gate mídia vs payload profundo | `mergeDeepMediaIntoEvolutionItem` + `extractEvolutionIngestibleMediaProtoHints` (`lib/server/crmMediaIngest.ts`) |

## Ordem dos branches no `POST` (após auth)

Resumo de `app/api/whatsapp/evolution/webhook/route.ts` (simplificado):

1. Auth `verifyEvolutionWebhook`
2. `hit` + `event_payload_diag` (diag condicionado a env)
3. QR por **nome** de evento (`isQrcodeUpdatedEvent`)
4. QR por **payload** — **só se não for rota upsert** (correção acima)
5. Edits / deletes / `messages.update`
6. **`looksLikeMessagesUpsert`** → `ensureCrmSchemaTables`, inbox, `items`, `defaultIds`, loop

Se o problema for “só mídia”, ainda assim inspeccionar **4** antes de insistir em SharePoint/Neon.

## Logs incondicionais úteis (Vercel)

Strings **específicas** para pesquisa (evitam só apanhar `[evolution-webhook] hit`):

- `route_post_entry_always`, `before_req_text_always`, `after_req_text_always`, `req_text_failed_always`, `before_json_parse_always`, `json_parse_failed_always`, `after_json_parse_always`
- `after_diag_before_upsert_branch_always` — confirma `isUpsert` / `routesToCrmUpsert`
- `before_crm_context_load_always`, `after_crm_context_load_always`
- `before_items_build_always`, `after_items_build_always`
- `loop_item_start_always`
- `upsert_gate_probe_always`, `upsert_ingest_gate`
- `[crm-media] evolution_detected` (e resto da trilha `crm-media`)

**Nota:** `event_payload_diag` depende de `CRM_EVOLUTION_WEBHOOK_EVENT_DIAG`; os `*_always` foram adicionados para diagnóstico sem env.

## Lição para o agente (futuro)

1. **Nunca assumir** que “diag vê mídia” implica que o código chegou ao upsert — pode haver **return anterior** com 200.
2. **Heurísticas que varrem o body inteiro** (QR, PII, “detector genérico”) são perigosas com payloads WhatsApp grandes.
3. Em Vercel, preferir **marcadores únicos** na string de log em vez de substring genérica do middleware.
4. Quando `hasMedia` / slots falham, alinhar **merge profundo** do item Evolution com o mesmo critério do diag (`mergeDeepMediaIntoEvolutionItem`, `extractEvolutionIngestibleMediaProtoHints`).

## Ficheiros tocados neste trabalho

- `app/api/whatsapp/evolution/webhook/route.ts` — ordem de branches, logs, `isUpsertRoute` + gate QR
- `lib/server/evolutionLastQr.ts` — `deepFindQrBase64` ignora protos de mídia
- `lib/server/crmMediaIngest.ts` — merge profundo, contagens, ingest (sessões anteriores)

## Ligações

- [webhook-crm.md](webhook-crm.md) — rota e payload
- [erros-e-diagnostico.md](erros-e-diagnostico.md) — tabela sintoma → causa
- [midia-inbound-outbound.md](../crm/midia-inbound-outbound.md) — pipeline SharePoint / Neon
