# Evolution API online — o que é `EVOLUTION_API_URL` e como conseguir

## Em uma frase

**`EVOLUTION_API_URL`** é o endereço **HTTPS público** onde a **Evolution API** está rodando (ex.: `https://evolution.seudominio.com`).  
**Não** é a URL do seu site na Vercel (`sao-luiz-site.vercel.app`). São **dois serviços**:

| Onde | O quê |
|------|--------|
| **Vercel** | Seu Next.js (CRM, webhook `/api/whatsapp/evolution/webhook`, `/evolution-pairing`) |
| **Outro servidor** | Evolution + Postgres + Redis (Docker), com **URL própria** |

O Next na Vercel **chama** a Evolution usando `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` no servidor.

---

## Caminho mais comum: VPS barata + Docker

1. Contrate uma VPS (ex.: **Hetzner**, **DigitalOcean**, **Contabo**, **Oracle Free Tier**) com Ubuntu.
2. Instale **Docker** e **Docker Compose**.
3. Copie para o servidor `deploy/docker-compose.evolution.yml` e `deploy/.env` (com `AUTHENTICATION_API_KEY` forte e `EVOLUTION_DB_PASSWORD`).
4. Suba: `docker compose -f docker-compose.evolution.yml up -d`
5. Por padrão a API escuta na **porta 8080**. Na internet você **não** expõe 8080 sem HTTPS; use um **proxy reverso**:
   - **Caddy** ou **Nginx** com **Let’s Encrypt** → domínio tipo `https://evo.seudominio.com` apontando para `localhost:8080`.
6. No painel do provedor de domínio, crie um **registro A** (ou CNAME) `evo.seudominio.com` → IP da VPS.
7. Teste no navegador: `https://evo.seudominio.com/manager` (deve abrir o Manager).
8. Na **Vercel** (e no `.env` local), defina:
   - `EVOLUTION_API_URL=https://evo.saoluizexpress.com.br` (sem barra no fim; produção atual)
   - `EVOLUTION_API_KEY` = **o mesmo** valor de `AUTHENTICATION_API_KEY` do `deploy/.env` da Evolution
9. Na Evolution (Manager), webhook:
   - `https://sao-luiz-site.vercel.app/api/whatsapp/evolution/webhook?token=SEU_EVOLUTION_WEBHOOK_TOKEN`

---

## Alternativas (menos “faça você mesmo”)

- **Railway / Render / Fly.io**: há templates de comunidade para Evolution API; você ganha uma URL tipo `https://algo.railway.app`. Leia o README do template (variáveis de banco Redis/Postgres).
- **Provedores que já vendem “Evolution hospedada”**: você recebe URL + painel; só encaixa no CRM como `EVOLUTION_API_URL`.

---

## Checklist rápido

- [ ] Evolution responde em **HTTPS** (não só `http://IP:8080` em produção).
- [ ] `EVOLUTION_API_URL` na Vercel = essa base **HTTPS**.
- [ ] `EVOLUTION_API_KEY` na Vercel = `AUTHENTICATION_API_KEY` da Evolution.
- [ ] Webhook da instância aponta para o **domínio da Vercel** + `/api/whatsapp/evolution/webhook?token=...`
- [ ] `EVOLUTION_CONNECT_PROXY_ENABLED=true` na Vercel se usar `/evolution-pairing` ou sync de webhook pelo app.

---

## O que **não** funciona

- Colocar `EVOLUTION_API_URL=http://127.0.0.1:8080` na Vercel: o servidor da Vercel **não** é o seu PC; não alcança seu Docker local.
- Usar só variáveis na Vercel **sem** ter Evolution em algum lugar público: o CRM não tem com quem falar.

Quando a Evolution estiver no ar com URL fixa, aí sim preencha `EVOLUTION_API_URL` com ela.

---

## Arranque limpo no CRM (Neon) após testes

Um único script (copiar/colar no SQL Editor do Neon, um `BEGIN`/`COMMIT`): [`scripts/sql/crm-clean-test-slate.sql`](../scripts/sql/crm-clean-test-slate.sql) — apaga dados de teste CRM, **atualiza** `evolution_server_url` das inboxes `EVOLUTION` para `https://evo.saoluizexpress.com.br`, repõe defaults do intake; opcionalmente descomente o `DELETE` de inboxes no fim do ficheiro. Faça **backup / branch** antes de executar.

Conferir se as inboxes EVOLUTION ficaram com a mesma base URL que a Vercel:

- `npm run check:evolution-inboxes` (usa `DATABASE_URL` e `EVOLUTION_API_URL` ou `EVOLUTION_EXPECTED_BASE_URL`).

## TLS com Caddy (exemplo)

Ficheiro de referência: [`deploy/Caddyfile.evolution.example`](../deploy/Caddyfile.evolution.example) — proxy `https://evo…` → `127.0.0.1:8080`.

## Diagnóstico no próprio CRM

Com sessão e permissão **MANAGE_SETTINGS**:

- `GET /api/diagnostics/evolution` — envs (mascaradas), lista de inboxes EVOLUTION vs URL da env, e um `fetch` rápido à raiz da API para reachability.
