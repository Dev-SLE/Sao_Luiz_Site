# Persistência na Evolution (DATABASE_*)

## Onde se configura

Variáveis de ambiente no **servidor da Evolution** (Docker Compose, `.env`, Evolution Manager) — **não** no Vercel nem no `.env` do Next.js do Pendencias.

## Quando importa para o CRM

- O fluxo **`key_only`** do `getBase64` depende de `getMessage(key)` encontrar a mensagem na BD da Evolution.
- Se a instância **não** grava mensagens, podes ver **Message not found** ou falhas intermitentes.

## Variáveis citadas em issues oficiais

Exemplo (ajustar à vossa stack):

- `DATABASE_ENABLED=true`
- `DATABASE_PROVIDER=postgresql` (ou o que usarem)
- `DATABASE_SAVE_DATA_NEW_MESSAGE=true`
- (outros `DATABASE_SAVE_*` conforme documentação da vossa versão)

## Quando **não** precisas mudar nada

Se já tens histórico de conversas na Evolution, media a funcionar noutras integrações, e `findMessages` devolve a mensagem — a persistência já está adequada.
