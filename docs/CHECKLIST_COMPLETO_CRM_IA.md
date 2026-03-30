# Checklist Completo CRM + IA (SLE)

Objetivo: validar de forma completa tudo que envolve CRM, WhatsApp (Evolution/Meta), Sofia IA, operacao, seguranca e readiness de producao.

## 1) Regras de execucao

- [ ] Executar na ordem: `Pre-check -> Base CRM -> Chat -> WhatsApp -> IA -> Operacao -> Seguranca -> Go/No-Go`.
- [ ] Marcar item como concluido apenas com evidencia (print/video, horario, ID de lead/conversa, log da Vercel).
- [ ] Em falha, registrar no bloco de achados e continuar o checklist.
- [ ] Testar com pelo menos 2 perfis (admin e atendente) e 2 numeros WhatsApp.

## 2) Pre-check tecnico (ambiente)

- [ ] Deploy atual acessivel no Vercel sem erro 500.
- [ ] Variaveis de ambiente configuradas (`DATABASE_URL`, `SESSION_SECRET`, chaves IA, Evolution).
- [ ] Banco acessivel e schema atualizado sem erro de migracao em runtime.
- [ ] Pelo menos 1 inbox Evolution ativa e conectada.
- [ ] Webhook Evolution sincronizado para eventos principais.
- [ ] Usuario admin valido para configuracao e usuario atendente para operacao.

## 3) Autenticacao e sessao

- [ ] Login com credenciais validas funciona.
- [ ] Sessao persiste apos `F5` em pagina protegida.
- [ ] Logout limpa sessao e bloqueia acesso.
- [ ] Ao recarregar, sistema retorna para a ultima pagina (nao volta para "Visao Geral" indevidamente).
- [ ] Tela de "Validando sessao" aparece sem travar a aplicacao.

## 4) CRM base (dados e estrutura)

### 4.1 Pipelines e estagios
- [ ] Pipeline padrao existe e abre corretamente.
- [ ] Criar pipeline novo nao perde estagios existentes dos leads.
- [ ] Migracao de pipeline preserva coerencia de etapa relativa.

### 4.2 Leads
- [ ] Criar lead manual salva todos os campos principais.
- [ ] Editar lead persiste valores apos refresh.
- [ ] Campos extras (protocolo, origem, prioridade, observacoes, etc.) mantem estado.
- [ ] Lead sem nome amigavel recebe fallback legivel (nao quebrado).

### 4.3 Conversas
- [ ] Conversa abre com mensagens historicas corretas.
- [ ] Conversa atualiza `last_message_at` corretamente.
- [ ] Resumo de conversa (`ai_summary`) persiste no banco.

## 5) Kanban e operacao diaria

- [ ] Drag and drop funciona sem "efeito elastico" perceptivel.
- [ ] Soltar na mesma coluna nao gera update desnecessario.
- [ ] Mudanca de status lateral no chat move card no kanban.
- [ ] Filtro "Somente meus leads" mostra apenas leads corretos no primeiro carregamento.
- [ ] Responsavel do card aparece no primeiro render.

## 6) Chat CRM (UX e produtividade)

### 6.1 Experiencia do atendente
- [ ] Ao selecionar conversa, rola automaticamente para o fim.
- [ ] Input: `Enter` envia e `Shift+Enter` quebra linha.
- [ ] Badge de nao lidas sobe corretamente em mensagens de cliente.
- [ ] Nome e preview em negrito quando nao lido; normaliza ao abrir conversa.
- [ ] Badge limita em `9+` quando excede 9.

### 6.2 Acoes de mensagem
- [ ] Responder (quote) aparece corretamente no CRM.
- [ ] Excluir (soft delete) muda para texto de removida sem quebrar timeline.
- [ ] Edicao de mensagem (quando provider enviar evento) reflete no CRM.
- [ ] Status outbound (pending/sent/delivered/read) evolui quando webhook retornar.

### 6.3 Campos laterais do lead
- [ ] Status da carga e status do cliente em formato padronizado (nao texto livre).
- [ ] Toggle de recorrencia/rastreamento persiste.
- [ ] Observacoes editaveis persistem apos refresh.

## 7) WhatsApp Evolution (Web)

### 7.1 Provisionamento e inbox
- [ ] Criar inbox Evolution no painel salva no banco.
- [ ] Modo rapido cria instancia quando habilitado.
- [ ] Sync de webhook ocorre automaticamente apos criar/editar inbox.
- [ ] Reativacao/edicao de inbox mantem configuracoes corretas.

### 7.2 Inbound
- [ ] Mensagem inbound chega no CRM.
- [ ] Novo contato inbound cria lead quando criterios permitem.
- [ ] Conversa e atividade sao criadas para novo lead.
- [ ] Duplicidade por `message_id` e evitada.

### 7.3 Outbound
- [ ] Mensagem enviada do CRM chega no WhatsApp.
- [ ] Mensagem enviada fora do CRM (celular/web) espelha no CRM.
- [ ] Falha de envio retorna erro legivel no CRM.

### 7.4 Avatar e nome
- [ ] Nome do contato web vem correto quando disponivel.
- [ ] Fallback de nome e amigavel quando contato sem nome.
- [ ] Foto de perfil e buscada via Evolution quando nao vem no payload.
- [ ] `contact_avatar_url` e atualizado no lead quando houver URL valida.

### 7.5 Observabilidade
- [ ] Logs da rota `/api/whatsapp/evolution/webhook` aparecem no Vercel.
- [ ] Logs mostram `event`, `instance`, `bodyKeys`, `dataKeys`.
- [ ] Eventos ignorados ficam explicitos no log (sem silencio).
- [ ] Casos de instance desconhecida ficam claros no log.

## 8) WhatsApp Meta (se aplicavel)

- [ ] Envio por Cloud API funciona para inbox nao-Evolution.
- [ ] Anexo (imagem/documento) envia quando canal Meta estiver ativo.
- [ ] Falhas entram em fila/outbox para retry quando aplicavel.

## 9) Sofia IA (configuracao + runtime)

### 9.1 Configuracao
- [ ] Tela de configuracoes carrega do banco.
- [ ] Salvar configuracoes persiste sem perder campos.
- [ ] Flags de operacao (auto reply, modo, horario, bloqueios) respeitadas.
- [ ] `Generate conversation summary` salva e recarrega corretamente.

### 9.2 Runtime da IA
- [ ] Ao abrir conversa com resumo vazio, IA gera resumo automaticamente.
- [ ] Resumo gerado e salvo em `ai_summary`.
- [ ] Em mensagem inbound de cliente, IA gera sugestao/resposta com contexto.
- [ ] Handoff por palavra-chave funciona (`humano`, `atendente`, etc.).
- [ ] IA evita repeticao evidente de fallback.
- [ ] Respostas respeitam limite maximo de caracteres configurado.

### 9.3 Governanca
- [ ] Fora de horario/dia ativo, autoenvio fica bloqueado.
- [ ] Quando SLA estourar (se configurado), exige humano.
- [ ] Bloqueios por topico/status sao obedecidos.

## 10) Times, permissoes e escopo

- [ ] Criar time, adicionar membro e remover membro funciona.
- [ ] Remocao de membro limpa atribuicoes de time relacionadas.
- [ ] Usuario sem permissao nao acessa escopo indevido.
- [ ] Admin visualiza tudo; atendente respeita `SELF/TEAM`.

## 11) Performance e estabilidade

- [ ] Criacao de lead inbound ocorre em tempo aceitavel (sem travas severas).
- [ ] Abrir conversa com historico nao congela interface.
- [ ] Troca entre conversas nao causa lag extremo.
- [ ] Rotas principais nao executam schema check pesado repetidamente.

## 12) Integridade de banco (checagem funcional)

- [ ] `crm_leads`: cria/atualiza com nome, telefone, status, avatar.
- [ ] `crm_conversations`: cria/atualiza status, atribuicao, `last_message_at`, `ai_summary`.
- [ ] `crm_messages`: grava sender, body, metadata, reply/delete/status.
- [ ] `crm_whatsapp_inboxes`: guarda instancia/provider/credenciais/inbox ativa.
- [ ] `crm_activities`: registra eventos relevantes de operacao.

## 13) Seguranca minima

- [ ] Cookie de sessao `HttpOnly` ativo.
- [ ] Webhook Evolution exige token em producao (quando configurado).
- [ ] Nenhum secret/chave aparece no front ou nos logs de forma aberta.
- [ ] Erros retornam mensagem controlada sem vazar stack sensivel.

## 14) Regressao rapida (smoke final)

- [ ] Login -> abrir CRM chat -> enviar mensagem -> receber resposta -> mover status -> refresh -> manter estado.
- [ ] Criar inbox Evolution -> sincronizar webhook -> testar inbound/outbound.
- [ ] Abrir conversa com resumo vazio -> gerar resumo IA -> salvar -> recarregar.

## 15) Achados da rodada (preencher)

| Item | Severidade | Resultado | Evidencia | Acao |
|------|------------|-----------|-----------|------|
|      |            |           |           |      |
|      |            |           |           |      |
|      |            |           |           |      |

## 16) Go/No-Go

### Go
- [ ] Blocos `Autenticacao`, `WhatsApp`, `IA runtime` e `Kanban` sem falha bloqueante.
- [ ] Sem perda de dados em lead/conversa/mensagem.
- [ ] Sem erro critico de permissao/escopo.

### No-Go
- [ ] Falha de inbound/outbound.
- [ ] Falha de sessao/login/F5.
- [ ] Falha de persistencia de dados principais.
- [ ] Falha de seguranca evidente (token/sessao/segredo).

---

Observacao: este checklist complementa o `DOCUMENTO_SUPREMO_HOMOLOGACAO_VERCEL.md` com cobertura mais ampla operacional e tecnica.
