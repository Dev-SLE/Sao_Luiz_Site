## Rodada atual - status apos novo teste

1. UX Chat - rolagem automatica ao abrir conversa  
Status: **Implementado (aguardando validacao manual)**  
Acao aplicada: auto-scroll para o final do container sempre que a conversa e carregada/trocada.

2. Sofia IA + resumo automatico  
Status: **Implementado parcial (aguardando validacao manual)**  
Acoes aplicadas:
- criada/ligada flag `generate_summary_enabled` nas configuracoes da Sofia;
- resumo automatico agora e requisitado ao abrir conversa (modo `SUMMARY`) e salvo em `ai_summary`;
- resposta automatica da Sofia e disparada ao detectar nova ultima mensagem do cliente na conversa aberta.

3. Fuso horario e avatar Web  
Status: **Implementado parcial (aguardando validacao manual)**  
Acoes aplicadas:
- frontend passou a formatar horario via `America/Sao_Paulo` com base em `createdAt`;
- endpoint de mensagens agora retorna `createdAt` ISO para formatacao correta no cliente;
- ajuste de avatar Web via `fetchProfile` ja havia sido aplicado na rodada anterior (manter reteste).

4. Sincronia Chat lateral x Kanban  
Status: **Implementado (aguardando validacao manual)**  
Acoes aplicadas:
- mantido vinculo dos botoes laterais para mudanca de `stage_id` no banco;
- mantida padronizacao dos campos de status (sem retorno para texto livre).

5. Remocao de usuario do time  
Status: **Implementado (aguardando validacao manual)**  
Acao aplicada: rota `REMOVE_MEMBER_FROM_TEAM` passou a remover o vinculo do membro na tabela de membros e limpar atribuicoes de time em leads/conversas do usuario.

6. Logs para mensageria Web muda (Evolution webhook)  
Status: **Implementado (aguardando validacao manual na Vercel)**  
Acao aplicada: logs detalhados no POST do webhook Evolution para rastrear payload recebido, instancia identificada, eventos ignorados e atualizacoes aplicadas.

---

## Prontidao para entrega (codigo + homologacao)

### Implementado no codigo (revisao seguranca)

- **Sessao**: em `NODE_ENV=production` so `AUTH_SESSION_SECRET` assina o cookie; sem ele o login retorna 503 e cookies existentes deixam de validar. Ver `.env.example`.
- **API legada**: `POST /api/markAsInSearch`, `/api/stopAlarm`, `/api/process_control` e `GET /api/process_control_by_cte` exigem sessao; `user_name` em `process_control` / alarmes vem do usuario logado (nao do corpo).
- **Manutencao**: `POST /api/whatsapp/retry_outbox` e `POST /api/rebuild_cte_view_index` aceitam `x-cron-secret` igual a `CRON_SECRET` **ou** sessao com permissao adequada (`MANAGE_CRM_OPS`/`MANAGE_SETTINGS` ou `MANAGE_SETTINGS`).
- **Senha**: `POST /api/changePassword` exige sessao e o `username` do corpo deve ser o mesmo usuario logado.
- **Cliente**: `fetchData` passa `credentials: include` para GET autenticados (ex.: historico `process_control_by_cte`).
- **Stub**: removido `updateCte` do cliente (nao havia chamadas).

### Homologacao manual (preencher)

Rodar na ordem [`docs/CHECKLIST_COMPLETO_CRM_IA.md`](CHECKLIST_COMPLETO_CRM_IA.md) e registrar na **secao 15 — Achados** e **16 — Go/No-Go** desse arquivo.

| Criterio Go/No-Go | Resultado | Data / evidencia |
|-------------------|-----------|------------------|
| Autenticacao + WhatsApp + IA runtime + Kanban | (preencher) | |
| Sem falha critica de permissao/escopo | (preencher) | |

---

## Mapa operacional (Life API + OSM)

- **Schema**: novas estruturas para telemetria e vínculo de carga
  - `operational_vehicle_positions`
  - `operational_vehicle_position_latest`
  - `operational_load_links`
  - `operacional_tracking_events` agora aceita `latitude`/`longitude`.
- **Sync seguro**: `POST /api/operational_tracking/sync`
  - aceita `x-cron-secret` (`CRON_SECRET`) ou permissao (`MANAGE_RASTREIO_OPERACIONAL` / `MANAGE_SETTINGS`);
  - consome `LIFE_TRACKING_API_URL` + `LIFE_TRACKING_TOKEN` (servidor).
- **Vinculo/baldeacao**: `POST /api/operational_tracking/link`
  - encerra vinculo ativo e cria novo (historico temporal), registrando evento de mudanca.
- **APIs estendidas**:
  - `GET /api/operational_tracking/items` devolve veiculo/placa, ultima lat/lng, idade do sinal.
  - `GET /api/operational_tracking/item` devolve trilha (ultimas 24h), vinculo ativo e historico.
- **UI Operacional**:
  - mapa OSM embutido com trilha e ultima posicao;
  - card de status de sinal (online/atrasado);
  - painel para vincular `CTE/MDF-e` ao veiculo/placa com motivo de baldeacao.

### Checklist rapido de homologacao do mapa (preencher)

| Item | Resultado | Evidencia |
|------|-----------|-----------|
| Sync Life salva pontos validos (lat/lng != 0) | (preencher) | |
| Vinculo CTE/MDF-e -> placa aparece no detalhe | (preencher) | |
| Troca de onibus cria historico (baldeacao) | (preencher) | |
| Trilha atualiza no mapa sem travar a tela | (preencher) | |