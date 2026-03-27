# CRM — Plano de teste ponta a ponta (E2E / homologação)

Documento para homologar o CRM (funil, chat, operações, WhatsApp Meta + Evolution, Sofia/triagem) **antes de publicar** em produção.  
Uso: marque cada item ao concluir; anote data, responsável e evidência (print, ID no Neon, log).

---

## 1. Tipos de teste neste documento

| Tipo | Objetivo |
|------|----------|
| **Smoke** | Sistema “sobe”: login, telas principais abrem sem erro 500/console crítico. |
| **Funcional** | Cada feature faz o que promete (botão, regra, filtro). |
| **Integração** | CRM ↔ banco ↔ APIs externas (Evolution, Meta, IA) com dados reais de teste. |
| **Regressão** | Bugs antigos não voltaram (placeholders `className`, envio WhatsApp, webhook). |
| **Carga leve** | Vários atendentes/conversas sem travar (opcional, ambiente de staging). |
| **Segurança básica** | Token webhook, URLs sensíveis não expostas no front; credenciais só no servidor. |

---

## 2. Pré-requisitos de ambiente

- [ ] **Vercel (ou host)** com `Root Directory` = `pendencias-sle-main`.
- [ ] **Neon/Postgres** com schema aplicado (`ensureSchema` já rodou em deploy ou migração manual).
- [ ] Variáveis mínimas no `.env` / Vercel (ajuste nomes conforme seu projeto):
  - [ ] `DATABASE_URL`
  - [ ] `EVOLUTION_WEBHOOK_TOKEN` (se usar secret no webhook)
  - [ ] `NEXT_PUBLIC_APP_URL` ou `EVOLUTION_WEBHOOK_PUBLIC_BASE` (webhook + modal “Sincronizar webhook”)
  - [ ] Evolution: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (para `/evolution-pairing` e `connect-proxy` **só se** usar esses caminhos globais)
  - [ ] `EVOLUTION_CONNECT_PROXY_ENABLED=true` se precisar dos proxies legacy em produção
  - [ ] IA (Sofia / triagem): `OPENAI_API_KEY` ou `GEMINI_API_KEY`, etc., conforme configurado
  - [ ] Meta Cloud API (linha oficial): `WHATSAPP_*` se testar canal Sofia/Meta
- [ ] **Evolution** acessível **da internet** (firewall) na URL cadastrada na caixa CRM.
- [ ] Pelo menos **2 usuários** com perfil de atendimento (`VIEW_CRM_CHAT` + escopo adequado).
- [ ] **2 números WhatsApp** de teste (ou 1 real + 1 secundário) para inbound/outbound.

---

## 3. Smoke — acesso e estabilidade

- [ ] Login com usuário admin e com usuário atendente.
- [ ] Abrir **CRM Dashboard**, **Funil**, **Chat**, **Operação CRM** sem tela branca.
- [ ] Console do navegador: sem `TypeError` recorrente (ex.: `className` de `undefined`).
- [ ] `favicon`/404 menores são aceitáveis; **não** aceitar erro que quebra lista de conversas.

---

## 4. Operação CRM — montagem (dados mestres)

### 4.1 Times e membros

- [ ] Criar time; adicionar membro (usuário existente); listar corretamente.
- [ ] Remover membro / excluir time (se aplicável) sem quebrar referências críticas.

### 4.2 Caixas WhatsApp Web (Evolution)

- [ ] **Nova caixa**: nome, URL Evolution, apikey, nome de instância **único** por linha.
- [ ] Opcional: marcar **“Criar instância na Evolution ao salvar”** e verificar na Evolution que a instância existe (ou erro tratado se duplicada).
- [ ] **Pessoal no site**: **“Parear no site”** → modal → **Gerar QR** → escanear → instância **conectada** (status no modal).
- [ ] **Sincronizar webhook + QR**: URL do webhook bate com o domínio público; token na query se configurado.
- [ ] Eventos na Evolution: `MESSAGES_UPSERT`, `QRCODE_UPDATED`, `CONNECTION_UPDATE`; ideal também `MESSAGES_EDITED`, `MESSAGES_UPDATE`.
- [ ] Editar caixa (sem reenviar apikey) mantém chave antiga.
- [ ] Desativar caixa: não deve mais rotear mensagens novas para ela (comportamento esperado documentado).

### 4.3 Regras de roteamento e SLA

- [ ] Criar regra (tópico / contains / destino usuário ou time); prioridade entre regras coerente.
- [ ] Criar regra de SLA; verificar exibição de SLA no chat quando aplicável.

### 4.4 Triagem anti-poluição (Evolution)

- [ ] Modos: `OFF`, `BUSINESS_ONLY`, `AGENCY_ONLY` — novo contato comporta-se como esperado.
- [ ] Allowlist / denylist manual e **importação CSV/XLSX** (+ template).
- [ ] Contagem de pendentes no buffer (se usar triagem) atualiza após cenários de teste.

---

## 5. Funil (Kanban) — leads

- [ ] Lead aparece na coluna correta; arrastar/mover estágio (se implementado) persiste após F5.
- [ ] Prioridade e origem com valores “estranhos” do banco **não** quebram o board (fallback UI).
- [ ] Criar lead manual; editar telefone/email/título; vincular agência se existir fluxo.
- [ ] Filtros e busca básica.

---

## 6. Chat CRM — conversas e mensagens

### 6.1 Lista e detalhe

- [ ] Lista de conversas: avatar (foto via proxy ou fallback), última mensagem, badge canal/caixa Web.
- [ ] Abrir conversa: histórico carrega; **“Contexto do lead (outras conversas)”** mostra outras threads do mesmo lead.

### 6.2 WhatsApp Evolution (caixa Web)

- [ ] **Inbound**: número externo manda texto → lead/conversa criados (ou buffer de triagem) e mensagem no chat.
- [ ] **Outbound pelo CRM**: resposta chega no WhatsApp do cliente.
- [ ] Mensagem enviada **pelo celular** (mesma sessão Web) aparece no CRM como atendente.
- [ ] **Mídia**: áudio/imagem aparecem como placeholder (“[Áudio recebido]”, etc.) + cartão visual no bubble.
- [ ] **Edição** no WhatsApp: texto atualizado no CRM após webhook `MESSAGES_EDITED` / update com texto (eventos habilitados).

### 6.3 Status de envio

- [ ] Mensagem enviada pelo CRM: deixa de ficar eternamente em **“Enviando”** quando entregue (metadados `outbound_whatsapp`).

### 6.4 Atribuição e posse

- [ ] Select de responsável lista só usuários com permissão de atendimento CRM.
- [ ] **Assumir conversa** / **Desbloquear**; **Devolver à fila**.
- [ ] Trocar responsável: histórico permanece na conversa (mensagens não somem).

### 6.5 Canal Meta / Sofia (se usar)

- [ ] Fluxo equivalente na linha oficial (se ainda em escopo do projeto).

---

## 7. Sofia (IA) no CRM

- [ ] **Sofia** — sugestão de resposta não quebra com conversa vazia ou longa.
- [ ] **Sofia Auto** (se ativo) respeita configurações e não envia em duplicidade indevida.
- [ ] Triagem com IA habilitada: contatos ambíguos vão para buffer/ não criam lead indevido (cenário controlado).

---

## 8. Integração Evolution ↔ Webhook ↔ Neon

Para **cada** caixa ativa:

- [ ] `crm_whatsapp_inboxes`: `evolution_instance_name` **igual** ao nome na Evolution (case não deve quebrar — já normalizado em minúsculas na query).
- [ ] Inserir mensagem de teste: linha em `crm_messages` com `metadata.message_id` e `conversation_id` corretos.
- [ ] `crm_leads.contact_avatar_url` atualiza quando há foto (fetch profile + proxy no front).
- [ ] Logs Vercel: sem 401 no webhook (token); sem timeout sistemático para Evolution.

---

## 9. Regressão — bugs conhecidos que não podem voltar

- [ ] `CrmChat` / `CrmFunnel`: sem crash por `channel` / `priority` / `source` inválidos.
- [ ] Webhook Evolution: não ignorar mensagens `fromMe` necessárias para espelhar envio pelo celular.
- [ ] Duplicidade: mesmo `message_id` não cria duas linhas em `crm_messages`.

---

## 10. Cenários negativos (falha controlada)

- [ ] Evolution **fora do ar**: CRM mostra erro claro ao parear/enviar (não silêncio infinito).
- [ ] Webhook com **token errado**: 401; corrigir token e reenviar evento.
- [ ] Instância **não cadastrada** na tabela de inboxes: webhook responde skipped / log; após cadastrar, próxima mensagem entra.
- [ ] Número em **denylist** ou fora de regra de negócio: não polui funil.

---

## 11. Critérios de “OK para publicar”

Definir go/no-go:

- [ ] Todos os itens **seção 3–6** críticos para o seu go-live estão verdes.
- [ ] Pelo menos **uma** caixa Evolution **end-to-end** (parear → receber → responder → espelho celular).
- [ ] Triagem e leads: decisão explícita se `BUSINESS_ONLY` ou outro modo em produção.
- [ ] Plano de rollback: tag git anterior + desligar webhook temporariamente se necessário.

---

## 12. Registro de execução (copiar por sprint)

| Data | Responsável | Ambiente (staging/prod) | Versão / branch | Bloqueios encontrados | Resolvido? |
|------|-------------|-------------------------|-----------------|------------------------|------------|
| | | | | | |

---

## 13. Melhorias futuras (não bloqueiam este plano)

- Playwright/Cypress automatizado para login + abrir chat.
- Teste de carga com muitas instâncias Evolution.
- Proxy de mídia para **reproduzir** áudio dentro do CRM (hoje: placeholder).

---

*Última revisão alinhada ao código em **Operação CRM** (caixas, modal de pareamento, webhook Evolution, triagem, chat, funil). Atualize este arquivo quando novos módulos entrarem no CRM.*
