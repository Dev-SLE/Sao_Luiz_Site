# Plano de Proxima Rodada - Pos-Homologacao

Objetivo: organizar as melhorias nao bloqueantes para a proxima sprint apos a validacao final em producao (Vercel).

## Regras desta rodada

- Implementar somente apos checklist de homologacao principal ficar verde.
- Entregar em blocos pequenos para reduzir risco de regressao.
- Cada item concluido precisa de:
  - evidencia funcional (print/video curto),
  - nota tecnica (endpoint/componente alterado),
  - caso de teste de regressao.

## Priorizacao (impacto x esforco)

### Bloco P1 - Alto impacto, baixo/medio esforco

1. Contato e UI
   - Corrigir nome de contato vindo como "WhatsApp".
   - Exibir badge de nao lidas na lista de conversas.

2. Mídia / Anexos
   - Garantir placeholder e card visual para audio/imagem/documento no chat.
   - Eliminar bolha "em branco" quando vier payload sem texto.

3. Identidade do atendente
   - Mostrar nome real do atendente que respondeu (multiatendimento), evitando remetente generico.

4. Enter para enviar
   - Tecla Enter envia mensagem; Shift+Enter quebra linha.

### Bloco P2 - Medio impacto, medio esforco

5. Sincronia lateral <-> modal de lead
   - Campos do painel lateral e modal de novo/edicao de lead devem refletir o mesmo estado.
   - Persistencia bidirecional no banco sem sobrescrever campos indevidamente.

6. Campo Observacoes
   - Tornar observacoes totalmente editavel e persistente por lead/conversa.

7. Acoes de mensagem
   - Iniciar "responder mensagem especifica" (arrastar/quote).
   - Excluir mensagem (validando limite da API Evolution + regras de seguranca).

### Bloco P3 - Alto valor estrategico, maior esforco

8. Toggles e automacoes de status
   - "Frete recorrente" e "Rastreio ativo" persistidos no banco.
   - Alterar status no painel lateral move o lead automaticamente no funil.

9. Sofia AI - Resumo operacional
   - Gerar resumo incremental da conversa (estilo resumo de e-mail).
   - Salvar resumo no CRM e atualizar a cada novas interacoes.

## Ordem sugerida de execucao

- Sprint 1: P1 completo.
- Sprint 2: P2 completo.
- Sprint 3: P3 (primeiro toggles/status, depois resumo Sofia).

## Checklist por item (template)

- [ ] Requisito funcional implementado.
- [ ] Regressao manual em Vercel executada.
- [ ] Logs sem erro critico.
- [ ] Documento atualizado (`Resumo_teste.md` + este plano).

## Riscos conhecidos

- Mudancas em chat e mensagens podem impactar envio Evolution/Meta.
- Sincronia bidirecional de lead pode gerar condicao de corrida sem controle de versao/updated_at.
- Resumo de IA exige politica clara de custo/limite de tokens.

## Definicao de pronto da proxima rodada

- Todos os itens P1 e P2 concluidos e validados em Vercel.
- Pelo menos 1 fluxo real de atendimento validado com inicio -> meio -> fim sem regressao.
- Documento de homologacao atualizado com status final de cada melhoria.
