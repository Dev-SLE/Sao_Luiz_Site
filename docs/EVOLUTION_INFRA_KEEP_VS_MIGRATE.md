# Decisao de infraestrutura Evolution (keep vs migrate)

## Objetivo
Definir uma decisao objetiva para infraestrutura de mensageria WhatsApp com base em SLO, risco operacional e custo total.

## SLO alvo
- Entrega >= 99.9%
- Perda funcional = 0
- p95 ingestao < 2s
- p95 envio < 5s

## Cenario A - VPS propria (estado atual: DigitalOcean)

A Evolution API passou a correr em **Droplet DigitalOcean** com Docker (Postgres + Redis no compose), em substituicao de testes anteriores noutra VPS (ex.: Oracle Cloud). O desenho continua o mesmo: **controlo total** da VM e da rede.

Pros:
- custo previsivel e controlo de configuracao
- mesma stack documentada em `deploy/docker-compose.evolution.yml`

Contras:
- operacao manual (patching, backup, observabilidade) continua a cargo da equipa

Hardening minimo recomendado:
- **TLS** na frente da API (Caddy/Nginx + Let's Encrypt); ver `deploy/Caddyfile.evolution.example`
- monitoramento ativo (healthcheck + alerta)
- backup e restore testado (Postgres Evolution + volume `evolution_instances`)
- restart supervisionado e limites de recursos no Docker/host

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
Com a base ja na **DigitalOcean**, a recomendacao pratica e:
1. Completar hardening (HTTPS, backups testados, alertas).
2. Manter evidencias de SLO (taxa de entrega, latencias) durante 7–14 dias.
3. Reavaliar **Cenario B** (provider gerenciado) apenas se os gatilhos de SLO ou custo operacional o justificarem.

## Evidencias que devem ser coletadas (7 dias)
- taxa de sucesso por mensagem
- latencia p50/p95 por etapa (inbound e outbound)
- retries e falhas finais
- incidentes, causa raiz e tempo de recuperacao
- custo real mensal (infra + horas operacionais)
