🚀 Relatório E2E Consolidado - CRM São Luiz Express
Responsável: Gabriel
Status da Homologação: Reprovado para Produção (Requer correções críticas em blocos)

✅ 1. O que DEU CERTO (Passou nos testes)
Smoke Test & Estabilidade: Variáveis de ambiente corretas, sistema abre sem telas brancas ou erros críticos de crash no console.

Gestão de Caixas (WhatsApp): Criação de caixas na UI com o "Modo Rápido", geração do QR Code e pareamento funcionando. A instância é criada corretamente na Evolution e salva no banco (crm_whatsapp_inboxes).

Kanban (Funil de Leads) - Estrutura: O recurso de arrastar os cards (Drag and Drop) salva a nova coluna e os leads permanecem no banco de dados.

🚧 2. Testes Pausados
Roteamento, SLA e Triagem (Buffer): Testes adiados. A lógica de roteamento e triagem de contatos sofrerá alterações profundas e será validada isoladamente depois.

🛠️ 3. PLANO DE AÇÃO PARA O CURSOR (Bugs Críticos)
Instrução para a IA (Cursor): Resolva os problemas abaixo seguindo estritamente a ordem de prioridade (Categoria A, depois B, depois C). Realize commits ao finalizar cada categoria.

🔴 CATEGORIA A: Bugs Críticos Core (Mensageria e Sessão)
1. Redirecionamento Incorreto de Login no F5

Problema: O usuário perde a sessão ao dar F5 em rotas protegidas e é forçado a voltar para o Login.

Ação: Revisar o middleware.ts e o AuthContext. Garantir que a leitura do cookie de sessão no servidor ocorra antes do render e que o hook de auth aguarde o estado de isLoading antes de disparar o redirecionamento.

Status de execução (Cursor):
- Concluído e validado em teste manual.
- Implementado: cookie HttpOnly de sessão no login (`/api/login`), leitura de sessão via `/api/auth/session` no carregamento do `AuthContext`, e bloqueio de render prematuro no `App` enquanto `loading=true`.
- Implementado: persistência da tela atual no navegador (`localStorage`) para recarregar no mesmo contexto (ex.: Chat CRM) após F5.

2. Webhook Inbound "Mudo" e Status Congelado (Evolution API)

Problema: Novas instâncias pareadas não recebem mensagens (gap no banco). O status de mensagens enviadas não atualiza (preso em "Enviando").

Ação 1: Na função de criar instância e no botão "Sincronizar Webhook + QR", garanta que o payload enviado para a Evolution inclua a URL pública completa do webhook e a ativação dos eventos: MESSAGES_UPSERT, MESSAGES_UPDATE, MESSAGES_EDITED, CONNECTION_UPDATE e QRCODE_UPDATED.

Ação 2: Revise a rota /api/whatsapp/evolution/webhook para processar o evento de update de status (ack) e atualizar a tabela crm_messages. Garanta que a sincronização no front (Realtime/Supabase) escute essas mudanças.

Status de execução (Cursor):
- Em validação manual.
- Implementado: tratamento de `MESSAGES_UPDATE` no webhook para atualizar `metadata.outbound_whatsapp.status` por `message_id` (mapeando `ack` numérico e status textuais), evitando mensagens presas em "Enviando".
- Implementado: na criação/edição de caixa Evolution (`/api/crm/whatsapp-inboxes`), sincronização automática de webhook com URL pública completa + eventos obrigatórios (`MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `MESSAGES_EDITED`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`).

3. Espelhamento Celular ↔ CRM Inexistente

Problema: Mensagens enviadas do celular físico do atendente não aparecem no chat do CRM.

Ação: Configurar a rota do Webhook para processar eventos com fromMe: true. Salvar essa mensagem na crm_messages atrelada a um remetente "Sistema/Empresa" ou ao usuário logado, refletindo na UI.

Status de execução (Cursor):
- Em validação manual.
- Implementado: `fromMe: true` não é mais bloqueado na triagem de novo contato (passa a criar/usar lead+conversa e persistir no CRM).
- Implementado: metadado `sender_label: "Sistema/Empresa"` para mensagens `fromMe`, com exibição no Chat CRM no lugar de rótulo genérico.

🟡 CATEGORIA B: Bugs de UI, Kanban e Permissões
4. Filtro "Meus Leads" e Atribuição Quebrados

Problema: Usuários "Atendentes" veem todos os leads da empresa. O filtro "Meus Leads" limpa a tela em vez de exibir os contatos do usuário logado.

Ação 1: Aplicar RLS (Row Level Security) ou filtro estrito na query do board para exibir apenas leads do usuário/time.

Ação 2: O filtro "Meus Leads" precisa comparar o UUID (ou ID) do usuário logado exatamente com a coluna assigned_to da tabela crm_leads.

Ação 3: Padronizar a exibição do nome/avatar do responsável no card do Lead (IA, Atendente X).

Status de execução (Cursor):
- Em validação manual.
- Implementado backend (`/api/crm/board`): escopo por usuário (ALL/TEAM/SELF) alinhado ao perfil/permissões CRM, com filtro por responsável (`assigned_username`/`owner_username`) e time.
- Implementado frontend (`CrmFunnel`): board passa `requestUsername/requestRole` ao backend e o filtro "Somente meus leads" compara corretamente o usuário logado com `assignedUsername` **ou** `ownerUsername`.

5. Drag & Drop do Funil (Efeito Elástico) e Reset de Estágios

Problema: Alguns leads voltam para a coluna original ao serem arrastados. Ao criar uma nova coluna, a tela reseta todos os leads para o "Primeiro Atendimento".

Ação: Corrigir a função onDragEnd. A UI não pode reverter o estado (Optimistic UI) sem um erro claro do banco. Revise a API de atualização de estágio (stage_id) para garantir o save no Neon antes de fixar no front. Ajuste o refetch ao criar novos estágios para preservar a ordem real.

Status de execução (Cursor):
- Concluído e validado em teste manual.
- Implementado frontend (`CrmFunnel`): drag/drop ignora drop na mesma coluna e rollback imediato/local em erro (sem esperar refetch), reduzindo efeito elástico visual.
- Implementado backend (`/api/crm/pipelines`): ao trocar funil padrão e mover leads, preserva estágio relativo por posição de coluna (com reordenação por bucket), evitando reset geral para "Aguardando atendimento".

6. Remoção de Usuário do Time (UI Faltante)

Problema: Não há botão para remover um usuário de um time na tela de Gestão.

Ação: Criar o botão "Remover Membro". A ação deve disparar um UPDATE setando o ID do time como null para aquele usuário, sem deletá-lo do sistema.

Status de execução (Cursor):
- Concluído e validado em teste manual.
- Implementado UI (`CrmOpsAdmin`): botão "Remover" por membro dentro do card de cada time.
- Implementado backend (`/api/crm/teams`, action `REMOVE_MEMBER_FROM_TEAM`): desativa vínculo em `crm_team_members` (sem deletar usuário do sistema) e limpa `assigned_team_id` de conversas/leads relacionados ao usuário.

🟣 CATEGORIA C: IA (Sofia) Desconectada
7. Loop de Fallback e Amnésia de Contexto

Problema: A Sofia repete a "Mensagem de Fallback" (pedindo CTE) como um bot de regras e não interage. Ela esquece o contexto se o cliente manda um "Ok".

Ação 1: Validar os logs para checar se a API do Gemini está falhando e forçando o fallback. Revisar a lógica de "Confiança Mínima".

Ação 2: Ajustar o payload enviado para a API do Gemini: é obrigatório enviar o array com o histórico das últimas X mensagens da conversa (roles user e model), e não apenas o último texto isolado.

Status de execução (Cursor):
- Em validação manual.
- Implementado (`/api/crm/sofia/respond`): envio de histórico estruturado para IA (OpenAI/Gemini) com papéis `user/model`, em vez de prompt isolado.
- Implementado: reforço anti-loop (detecção de repetição contra últimas respostas IA e fallback mais contextual), reduzindo repetição da mesma frase.
- Ajustado fallback: detecção de slots usa apenas texto real da conversa (não contaminação por mensagem fallback configurada).

8. Triagem e Handoff Ignorados

Problema: Palavras-chave ("atendente", "humano") não bloqueiam a IA.

Ação: O middleware de interceptação de palavras-chave deve rodar antes de acionar o Gemini. Havendo match, o sistema deve abortar a IA, alterar o status do lead, notificar o Kanban e disparar a "Mensagem de Handoff".

Status de execução (Cursor):
- Em validação manual.
- Implementado (`/api/crm/sofia/respond`): interceptação de palavras-chave antes da chamada de IA; com match, aborta Gemini/OpenAI, atualiza status (`crm_conversations` + `crm_leads`) para handoff humano e registra atividade.
- Implementado (`CrmChat` / Sofia Auto): quando `reason=keyword_detected`, envia automaticamente a mensagem de handoff no chat e interrompe auto-resposta normal.

Observação de processo:
- Validação final desta rodada será feita em ambiente Vercel (online), seguindo `docs/CHECKLIST_VALIDACAO_VERCEL.md`.
- Planejamento da próxima sprint pós-homologação documentado em `docs/PLANO_PROXIMA_RODADA_POS_HOMOLOGACAO.md`.

✨ 4. BACKLOG DE MELHORIAS (Ajustes Visuais e Operacionais no Chat)
Instrução para a IA (Cursor): Implementar essas melhorias apenas após as Categorias A e B dos Bugs Críticos estarem resolvidas.

Contato e UI: Corrigir nomes de contatos vindo como "WhatsApp". Adicionar badge (bolinha) com quantidade de mensagens não lidas na lista.
Status de execução (Cursor):
- Implementado: normalização visual no `CrmChat` para evitar título genérico "WhatsApp" (fallback para "Contato ####" quando aplicável).
- Implementado: contador de não lidas no backend (`/api/crm/conversations`) calculado por mensagens de cliente após última resposta de agente/IA.

Mídia / Anexos: Inserir placeholders e cards visuais no chat para áudio/imagem, evitando "mensagens em branco".
Status de execução (Cursor):
- Concluído anteriormente nesta rodada (placeholders por tipo + render sem "balão vazio").

Identidade do Atendente: Exibir o nome de quem respondeu a mensagem no multiatendimento (em vez de remetente genérico).
Status de execução (Cursor):
- Concluído anteriormente nesta rodada (`sender_label` e exibição `fromLabel` no chat).

Ações de Mensagem: Função de arrastar para responder uma mensagem específica; botão para excluir mensagem (checando a API da Evolution); e permitir envio com a tecla Enter.
Status de execução (Cursor):
- Implementado: atalho `Enter` envia e `Shift+Enter` quebra linha.
- Implementado: ação de responder mensagem (quote contextual) com persistência no `metadata.reply_to`.
- Implementado: exclusão no CRM via botão na bolha + `DELETE /api/crm/messages` (soft-delete com trilha no metadata).
- Observação: integração de exclusão remota na Evolution ainda depende de confirmação final do endpoint/provider na homologação Vercel.

Sincronia Lateral vs Modal de Lead: O painel de "Dados do Cliente" no chat e o modal de "Novo Lead" devem ser espelhos bidirecionais salvando perfeitamente no banco (Prioridade, Origem, etc).
Status de execução (Cursor):
- Implementado: painel lateral do chat agora lê e persiste os principais campos do lead (`protocolNumber`, `source`, `priority`, `routeOrigin`, `routeDestination`, `requestedAt`, `serviceType`, `cargoStatus`, `customerStatus`, `currentLocation`, além de `observations`, `isRecurringFreight` e `trackingActive`).
- Implementado: consulta de conversas (`/api/crm/conversations`) enriquecida com metadados do lead para refletir no chat os mesmos dados usados no modal do funil.

Toggles e Status: Botões de "Frete recorrente" e "Rastreio ativo" devem ser toggles persistentes no banco. Alterar o status no painel lateral (ex: "Concluído") deve mover o Lead automaticamente de coluna no Funil.
Status de execução (Cursor):
- Implementado: campos `is_recurring_freight` e `tracking_active` adicionados e persistidos no banco.
- Implementado: mudança de status da conversa no lateral tenta mover o lead automaticamente para estágio compatível do funil (por nome da coluna).

Campo Observações: Tornar o campo de observações editável livremente pelo atendente.
Status de execução (Cursor):
- Implementado: `observations` persistente em `crm_leads` com edição livre no painel lateral.

Sofia AI (Resumo): Adicionar local onde a IA gere um resumo rápido do histórico da conversa para situar o atendente. mas logico ficar salvo e ir atualizando de acordo, pense em como seria um resumo de email do gmail que tem com o gemini.
Status de execução (Cursor):
- Implementado: campo de resumo incremental por conversa no painel "Resumo", salvo em `crm_conversations.ai_summary`.
- Implementado: suporte de persistência com `ai_summary_updated_at` para versionamento temporal de contexto.
- Implementado no escopo desta rodada: fluxo assistido/manual pronto para homologação (salvar, editar e reaproveitar contexto por conversa).