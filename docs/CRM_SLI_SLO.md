# CRM SLI/SLO (base inicial)

## SLI (indicadores)
- **API latência p95** por rota crítica (`/api/crm/messages`, `/api/crm/conversations`, `/api/whatsapp/evolution/webhook`)
- **Taxa de erro** (`5xx`) por rota e por integração externa (Meta/Evolution/OpenAI/Gemini/SMTP)
- **Tempo de processamento webhook** (recebimento até persistência da mensagem)
- **Backlog do outbox** (`crm_outbox` em `PENDING/FAILED`)

## SLO (metas iniciais)
- **Disponibilidade API CRM**: 99.5% mês
- **p95 rotas CRM principais**: < 800ms
- **Webhook Evolution ingestão**: 99% < 2s
- **Outbox pendente > 15 min**: no máximo 2% das mensagens no período

## Alertas recomendados
- Erro `5xx` > 3% por 5 min
- Webhook com falha de autenticação em sequência (>20 em 10 min)
- Outbox `FAILED` acima de 50 itens
- Queda abrupta de mensagens recebidas (>70% abaixo da média hora/hora)

## Teste de carga (roteiro)
1. Simular pico de webhook com payloads reais anonimizados.
2. Medir latência p95/p99 e escrita em `crm_messages`.
3. Avaliar saturação de outbox em paralelo.
4. Repetir com IA ativa e IA desativada para comparar impacto.
