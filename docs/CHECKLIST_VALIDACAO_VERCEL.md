# Checklist de Validacao Vercel - CRM SLE

Objetivo: validar em ambiente online (Vercel) todas as correcoes implementadas nesta rodada, com foco em regressao e comportamento real de integracoes.

## Como usar

- Marque cada item como `[x]` quando aprovado em Vercel.
- Se falhar, anote evidencias (print, horario, payload, log).
- Priorize a ordem: A -> B -> C.

## Categoria A

### A1 - Sessao e F5

- [ ] Login permanece ativo ao dar F5 em rota protegida.
- [ ] Sistema retorna para a mesma tela (ex.: `CRM_CHAT`) apos recarregar.

### A2 - Evolution inbound e status

- [ ] Nova caixa Evolution recebe inbound no CRM apos pareamento.
- [ ] Mensagem enviada sai de "Enviando" para `sent/delivered/read`.
- [ ] Webhook de caixa criada/editada esta com URL publica correta e eventos obrigatorios:
  - `MESSAGES_UPSERT`
  - `MESSAGES_UPDATE`
  - `MESSAGES_EDITED`
  - `CONNECTION_UPDATE`
  - `QRCODE_UPDATED`

### A3 - Espelhamento celular -> CRM

- [ ] Mensagem enviada no celular (sessao Web) aparece no chat CRM.
- [ ] Mensagem `fromMe` aparece com identificacao `Sistema/Empresa`.

## Categoria B

### B4 - Meus Leads e atribuicao

- [ ] Atendente nao enxerga board global indevido.
- [ ] Filtro "Somente meus leads" mostra leads do usuario (por `assigned` ou `owner`).

### B5 - Drag/drop e reset de estagios

- [ ] Arrastar card entre colunas persiste sem "efeito elastico" indevido.
- [ ] Criar novo funil padrao com migracao nao reseta todos para a primeira coluna.

### B6 - Remover membro de time

- [ ] Botao "Remover" aparece para membros em Gestao de Times.
- [ ] Remocao nao exclui usuario do sistema.
- [ ] Vinculo de time e limpo para conversas/leads do membro removido.

## Categoria C

### C7 - Sofia (fallback/contexto)

- [ ] Sofia nao repete fallback identico em loop.
- [ ] Mensagens curtas ("ok") mantem contexto da conversa.
- [ ] Resposta considera historico recente (nao apenas ultima mensagem).

### C8 - Triagem por palavra-chave e handoff

- [ ] Palavras-chave (ex.: "atendente", "humano") bloqueiam IA antes da geracao.
- [ ] Conversa/lead sao marcados para atendimento humano.
- [ ] Mensagem de handoff e disparada no fluxo auto da Sofia.
- [ ] Kanban/CRM refletem o estado de handoff.

## Categoria D (Backlog implementado nesta rodada)

### D1 - Contato/UI e nao lidas

- [ ] Conversas com nome generico "WhatsApp" aparecem com fallback amigavel ("Contato ####").
- [ ] Badge de nao lidas sobe quando cliente envia e zera apos resposta humana/IA.

### D2 - Acoes de mensagem

- [ ] `Enter` envia mensagem e `Shift+Enter` quebra linha.
- [ ] Acao "responder" referencia mensagem original no envio (quote visivel).
- [ ] Acao "excluir" remove mensagem no CRM (soft-delete) sem quebrar timeline.

### D3 - Painel lateral persistente

- [ ] Campo "Observacoes" persiste apos reload/troca de conversa.
- [ ] Toggles "Frete recorrente" e "Rastreio ativo" persistem no banco.
- [ ] Mudanca de status no painel lateral move o lead para coluna compativel no funil.

### D4 - Resumo IA por conversa

- [ ] Campo "Resumo incremental" salva e recarrega por conversa.
- [ ] `ai_summary_updated_at` atualiza no backend a cada salvamento.

## Evidencias por execucao

| Data | Ambiente | Responsavel | Item | Resultado | Evidencia |
|------|----------|-------------|------|-----------|-----------|
|      | Vercel   |             |      |           |           |
