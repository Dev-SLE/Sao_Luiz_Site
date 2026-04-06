console.log(`
Plano de teste de carga CRM:
1) Capturar payloads anonimizados de /api/whatsapp/evolution/webhook.
2) Reproduzir 100, 300 e 600 req/min em janelas de 5min.
3) Medir:
   - latência p95/p99
   - erro HTTP
   - backlog crm_outbox PENDING/FAILED
4) Repetir com IA ligada/desligada.
5) Registrar resultados no documento docs/CRM_SLI_SLO.md.
`);
