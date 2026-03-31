# Guia Completo: CRM, Sofia, Permissões e Operação

## 1) Visão geral

Este guia documenta como configurar e operar:

- Permissões por módulo/aba/ação/escopo.
- CRM (funil, chat, roteamento, SLA).
- Sofia (governança, autoatendimento e handoff).
- Triagem de novos contatos (Evolution e Meta).
- Notificações operacionais por atribuição.
- Tema escuro harmonioso.

---

## 2) Permissões e perfis

### 2.1 Catálogo de permissões

O catálogo foi centralizado em:

- `lib/permissions.ts`

Categorias:

- **Módulo**: `module.operacional.view`, `module.crm.view`, `module.comercial.view`, `module.admin.view`
- **Aba**: `tab.operacional.*`, `tab.crm.*`
- **Ação**: `crm.leads.*`, `crm.messages.*`, `operacional.assignment.*`, `operacional.notes.*`
- **Escopo**: `scope.crm.self|team|all`, `scope.operacional.unit.self|all`

Compatibilidade com permissões legadas:

- `VIEW_*`, `CRM_SCOPE_*`, `ASSIGN_OPERATIONAL_PENDING`, `RETURN_OPERATIONAL_PENDING`, etc.

### 2.2 Como atribuir permissões

1. Acesse `Configurações -> Perfis`.
2. Edite ou crie perfil.
3. Selecione permissões por grupo (módulo/aba/ação/escopo).
4. Salve o perfil.
5. Acesse `Configurações -> Usuários` e associe o perfil ao usuário.

### 2.3 Escopo recomendado por perfil

- **Admin**: todas permissões.
- **Supervisor Operacional**:
  - `module.operacional.view`
  - abas operacionais necessárias
  - `operacional.assignment.assign|unassign`, `operacional.notes.edit`
  - `scope.operacional.all` (ou unidade específica conforme política)
- **Supervisor Comercial/CRM**:
  - `module.crm.view`, `tab.crm.funil.view`, `tab.crm.chat.view`
  - `crm.leads.view|assign|edit`, `crm.messages.send`
  - `scope.crm.team` (ou `scope.crm.all` quando aplicável)
- **Atendente CRM**:
  - `module.crm.view`, `tab.crm.chat.view`
  - `crm.messages.send`, `crm.leads.view`
  - `scope.crm.self`

---

## 3) CRM e roteamento

### 3.1 Dono da caixa como responsável inicial

A regra padrão de entrada de conversa é:

1. Se a inbox tem `owner_username` válido, a conversa entra nesse usuário.
2. Somente se não houver owner válido: fallback para time/fila.

Arquivo-chave:

- `lib/server/crmRouting.ts`

### 3.2 Escopo server-side

Rotas críticas passaram a considerar sessão do servidor para evitar spoof de `requestUsername/requestRole` no frontend:

- `app/api/crm/conversations/route.ts`
- `app/api/crm/board/route.ts`
- `app/api/crm/messages/route.ts`
- `app/api/ctes_view/route.ts`
- `app/api/ctes_view_counts/route.ts`
- `app/api/cte_assignments/route.ts`

Helper central:

- `lib/server/authorization.ts`

---

## 4) Sofia (governança configurável)

### 4.1 Configuração principal

Tela:

- `components/SofiaSettings.tsx`

API:

- `app/api/crm/sofia/route.ts`

Campos importantes:

- Provedor/modelo (`aiProvider`, `modelName`)
- `autoMode` (`ASSISTIDO`, `SEMI_AUTO`, `AUTO_TOTAL`)
- `minConfidence`
- Horário e dias ativos
- `blockedTopics`, `blockedStatuses`
- `requireHumanIfSlaBreached`
- `requireHumanAfterCustomerMessages`
- `systemInstructions`, `fallbackMessage`, `handoffMessage`

### 4.2 Base comum de prompt

A base de governança/prompt foi centralizada em:

- `lib/server/sofiaGovernance.ts`

Usada em:

- `app/api/crm/sofia/respond/route.ts`
- `app/api/whatsapp/webhook/route.ts`

---

## 5) Triagem de novos contatos

### 5.1 Configuração da triagem

Tela:

- `components/CrmOpsAdmin.tsx` (bloco de triagem)

API:

- `app/api/crm/evolution-intake-settings/route.ts`

Configuração agora contempla:

- **Evolution**: `leadFilterMode`, `aiEnabled`, `minMessagesBeforeCreate`
- **Meta**: `metaLeadFilterMode`, `metaAiEnabled`, `metaMinMessagesBeforeCreate`
- Allowlist/denylist por últimos 10 dígitos

### 5.2 Triagem manual pendente

Nova API:

- `app/api/crm/evolution-intake-buffer/route.ts`

Ações:

- `APPROVE`: cria/vincula lead e marca buffer como aprovado
- `REJECT`: remove item pendente da triagem

UI:

- Lista de pendentes + botões Aprovar/Rejeitar em `CrmOpsAdmin`

---

## 6) Notificações operacionais (sino)

Backend:

- `app/api/operational-notifications/route.ts`

Comportamento:

- Lê eventos de `app_logs` (`CTE_ASSIGNMENT_UPSERT`, `CTE_ASSIGNMENT_CLEAR`)
- Mantém ACK por usuário em `pendencias.operational_notification_acks`

Frontend:

- `App.tsx` (sino no header, dropdown e ação “Marcar lidas”)

---

## 7) Tema escuro harmonioso

Foi adicionado:

- Toggle no header (`App.tsx`)
- Persistência em `localStorage` (`sle_theme_dark`)
- Classe global `html.sle-theme-dark`
- Overrides em `index.css`

Objetivo: escurecer sem “preto total”, preservando contraste e identidade visual.

---

## 8) Assinatura de mensagens e resposta encadeada

### 8.1 Assinatura automática no WhatsApp

Ao enviar do CRM:

- Atendente: `Nome Do Atendente: mensagem`
- IA: `Sofia (IA): mensagem`

Arquivo:

- `app/api/crm/messages/route.ts`

### 8.2 Resposta estilo WhatsApp (quoted reply)

- Outbound com `context.message_id` (Meta) e quoted payload (Evolution)
- Inbound salva `reply_to` no metadata para render no chat

Arquivos:

- `app/api/crm/messages/route.ts`
- `lib/server/evolutionClient.ts`
- `app/api/whatsapp/webhook/route.ts`
- `app/api/whatsapp/evolution/webhook/route.ts`
- `components/CrmChat.tsx`

---

## 9) Plano de testes (checklist)

## 9.1 Permissões e escopo

- [ ] Usuário sem `module.crm.view` não acessa CRM.
- [ ] Usuário `scope.crm.self` vê só conversas atribuídas a ele.
- [ ] Usuário `scope.crm.team` vê somente time.
- [ ] Usuário sem `crm.messages.delete` recebe 401 ao excluir mensagem.
- [ ] Usuário sem `operacional.assignment.assign` recebe 401 ao atribuir.

## 9.2 Dono da caixa

- [ ] Nova conversa de inbox com owner entra no owner.
- [ ] Sem owner válido, cai em fallback de fila/time.

## 9.3 Sofia

- [ ] Alterar `systemInstructions` na tela impacta resposta.
- [ ] `autoMode=ASSISTIDO` não autoenvia.
- [ ] `AUTO_TOTAL` + critérios válidos autoenvia.
- [ ] Com SLA estourado e regra ativa, bloqueia autoenvio.

## 9.4 Triagem

- [ ] Em `BUSINESS_ONLY`, contato sem sinal de negócio não cria lead.
- [ ] Allowlist cria lead mesmo sem sinal.
- [ ] Denylist bloqueia criação.
- [ ] Aprovar pendente cria/vincula lead.
- [ ] Rejeitar remove da fila de pendentes.

## 9.5 Notificações

- [ ] Atribuição operacional gera item no sino.
- [ ] Devolução operacional gera item no sino.
- [ ] “Marcar lidas” reduz contador para zero.

## 9.6 Tema

- [ ] Toggle de tema persiste após refresh.
- [ ] Campos, tabelas e cards mantêm legibilidade no escuro.

---

## 10) Operação recomendada inicial

1. Definir perfis (Admin, Supervisor Operacional, Supervisor CRM, Atendente).
2. Configurar inboxes com owner.
3. Revisar roteamento + SLA.
4. Ajustar Sofia em modo `ASSISTIDO` por 1-2 dias.
5. Ativar `SEMI_AUTO` e depois `AUTO_TOTAL` por etapas.
6. Monitorar triagem pendente diariamente na tela de CRM Ops.
