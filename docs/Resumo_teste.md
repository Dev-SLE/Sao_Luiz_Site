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