# Contexto agente (Pendencias)

Notas **curtas e acionáveis** para o agente e para humanos: integrações CRM, Evolution, logs em Vercel, e armadilhas já vistas no repo.

## Onde ir primeiro

| Tema | Documento |
|------|-----------|
| Evolution × CRM (webhook, eventos, 401) | [evolution/README.md](evolution/README.md) |
| **Incidente mídia no body mas sem upsert/ingest (abr. 2026)** | [evolution/playbook-debug-webhook-midia-2026-04.md](evolution/playbook-debug-webhook-midia-2026-04.md) |
| Sintomas → causas → ações | [evolution/erros-e-diagnostico.md](evolution/erros-e-diagnostico.md) |
| Rota webhook, payload típico | [evolution/webhook-crm.md](evolution/webhook-crm.md) |
| getBase64 / mídia | [evolution/getBase64-e-midia.md](evolution/getBase64-e-midia.md) |
| Mídia inbound/outbound no CRM | [crm/midia-inbound-outbound.md](crm/midia-inbound-outbound.md) |
| Links externos | [referencias/links-uteis.md](referencias/links-uteis.md) |

## Pasta `logs/`

Pode conter exports JSONL do Vercel (exemplos). Não é índice normativo; o playbook acima descreve **que strings procurar** nos logs de runtime.

## Arquivo

Material muito antigo ou duplicado: [_arquivo/README.md](_arquivo/README.md).
