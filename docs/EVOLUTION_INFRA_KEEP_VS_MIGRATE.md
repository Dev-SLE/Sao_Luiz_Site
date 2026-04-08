# Decisao de infraestrutura Evolution (keep vs migrate)

## Objetivo
Definir uma decisao objetiva para infraestrutura de mensageria WhatsApp com base em SLO, risco operacional e custo total.

## SLO alvo
- Entrega >= 99.9%
- Perda funcional = 0
- p95 ingestao < 2s
- p95 envio < 5s

## Cenario A - manter VPS atual (Oracle)
Pros:
- menor custo direto mensal
- controle total de configuracao e rede
- sem migracao imediata

Contras:
- risco maior de operacao manual
- exige disciplina de patching, backup e observabilidade
- recuperacao de incidente depende do time interno

Hardening minimo obrigatorio:
- monitoramento ativo (healthcheck + alerta)
- backup e restore testado semanalmente
- failover simplificado (instancia secundaria pronta)
- restart supervisionado e limites de recursos

## Cenario B - migrar para provider gerenciado
Pros:
- maior disponibilidade nativa
- operacao simplificada com suporte
- telemetria pronta e menor tempo de recuperacao

Contras:
- custo mensal maior
- lock-in de fornecedor
- janela de migracao e homologacao

## Matriz de decisao (ponderada)
- Confiabilidade/SLO: 45%
- Custo total: 25%
- Complexidade operacional: 20%
- Tempo de recuperacao: 10%

## Recomendacao
Recomendacao faseada:
1. curto prazo: manter VPS com hardening completo e SLO instrumentado.
2. gatilho de migracao: se 2 semanas consecutivas abaixo de 99.9% ou incidente critico recorrente.
3. medio prazo: preparar plano de migracao para provider gerenciado com rollback documentado.

## Evidencias que devem ser coletadas (7 dias)
- taxa de sucesso por mensagem
- latencia p50/p95 por etapa (inbound e outbound)
- retries e falhas finais
- incidentes, causa raiz e tempo de recuperacao
- custo real mensal (infra + horas operacionais)
