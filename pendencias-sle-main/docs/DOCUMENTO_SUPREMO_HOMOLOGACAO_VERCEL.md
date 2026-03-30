# Documento Supremo - Homologacao Vercel (CRM SLE)

Objetivo: validar ponta a ponta tudo que foi implementado nesta rodada, com criterio claro de **Aprovado/Reprovado**, evidencias e prioridade de execucao.

## 1) Regra de execucao

- Ordem obrigatoria: `A -> B -> C -> D -> E`.
- Marcar `[x]` apenas com evidencia (print, video curto, horario, conversa/lead id, log).
- Em falha, registrar no bloco "Achados" e seguir para o proximo item (nao parar a rodada).

## 2) Ambiente e pre-check

- [ ] Deploy atual no Vercel publicado e abrindo sem erro 500.
- [ ] Banco acessivel e schema atualizado.
- [ ] Pelo menos 1 caixa Evolution ativa, conectada e com webhook sincronizado.
- [ ] 2 numeros de teste disponiveis (cliente/atendente).
- [ ] Usuario admin e usuario atendente validos.

## 3) Bloco A - Sessao, Login e F5

- [ ] Login funciona e abre sistema sem tela quebrada.
- [ ] Em rota protegida, dar `F5` nao desloga.
- [ ] Ao recarregar em `CRM_CHAT`, retorna na mesma pagina.
- [ ] Tela "Validando sessao" aparece com animacao e depois some normalmente.

## 4) Bloco B - Evolution, Inbound/Outbound e Espelhamento

- [ ] Mensagem inbound do WhatsApp chega no CRM.
- [ ] Outbound enviado do CRM chega no WhatsApp.
- [ ] Mensagem enviada pelo celular (sessao web) espelha no CRM.
- [ ] Status de outbound sai de "Enviando" para entregue/lida quando houver retorno.
- [ ] Nome de contato Web nao fica generico ("WhatsApp/unknown"): aparece fallback amigavel.
- [ ] Avatar/foto do contato aparece quando a origem fornece foto; sem foto, fallback visual correto.

## 5) Bloco C - Funil, Permissao e Operacao

- [ ] "Somente meus leads" mostra somente os leads corretos.
- [ ] Drag/drop entre colunas persiste sem efeito elastico.
- [ ] Mudar status lateral no chat move lead para coluna compativel.
- [ ] Remover membro de time funciona sem excluir usuario do sistema.

## 6) Bloco D - Chat CRM (UI e produtividade)

### 6.1 Nao lidas e destaque visual

- [ ] Bolinha de nao lidas sobe quando chega mensagem nova do cliente.
- [ ] Contato/mensagem ficam em negrito quando ha nao lidas.
- [ ] Ao entrar na conversa, volta ao normal (lida).
- [ ] Quando passar de 9, badge mostra `9+`.
- [ ] Pulse discreto aparece so quando chega nova nao lida.

### 6.2 Acoes de mensagem

- [ ] `Enter` envia e `Shift+Enter` quebra linha.
- [ ] "Responder" no CRM mostra quote no bubble corretamente.
- [ ] "Excluir" no CRM troca para mensagem removida e nao quebra timeline.

### 6.3 Importante (escopo atual vs comportamento WhatsApp nativo)

- [ ] Confirmar comportamento atual: excluir/responder implementados no CRM (camada interna).
- [ ] Confirmar comportamento atual: no WhatsApp do cliente, ainda nao executa delete/quote nativo.
- [ ] Registrar como "gap conhecido" para proxima rodada, nao como regressao desta.

## 7) Bloco E - Sofia IA

- [ ] Sofia nao entra em loop repetitivo de fallback.
- [ ] Mensagens curtas ("ok") mantem contexto.
- [ ] Keyword handoff ("humano/atendente") interrompe IA e encaminha para humano.
- [ ] Resumo incremental por conversa salva e recarrega.

## 8) Achados desta homologacao (preencher durante o teste)

| Item | Severidade | Resultado | Evidencia | Observacao |
|------|------------|-----------|-----------|------------|
| Excluir no CRM nao apaga no WhatsApp nativo | Media | Aberto conhecido | | Funciona como soft-delete interno |
| Responder no CRM nao sai como quote nativo no WhatsApp | Media | Aberto conhecido | | Funciona no CRM, nao no provider nativo |
| | | | | |

## 9) Criterio de Go/No-Go

### Go (liberar)
- Todos os itens criticos dos blocos `A/B/C` aprovados.
- Blocos `D/E` sem erro bloqueante de atendimento.
- Achados conhecidos documentados com plano.

### No-Go (segurar)
- Falha em sessao/F5/login.
- Falha de inbound/outbound Evolution.
- Falha de permissao/escopo de atendimento.

## 10) Plano pos-homologacao (curto)

- Abrir card especifico para "delete/quote nativo no WhatsApp provider".
- Definir endpoint/capacidade oficial da Evolution para essas acoes.
- Validar impacto em auditoria/historico antes de ativar comportamento destrutivo remoto.
