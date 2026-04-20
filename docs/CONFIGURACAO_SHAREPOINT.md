# Configuração oficial: somente SharePoint (sem Google Drive)

Este guia descreve **o que configurar**, **onde** (Microsoft 365, Vercel/host, Neon) e **como obter** IDs e segredos usados pelo São Luiz Express. Com tudo preenchido e `STORAGE_DEFAULT_PROVIDER=sharepoint`, o sistema usa **Microsoft Graph (app-only)** para subir e ler arquivos no SharePoint; o **Neon (Postgres)** guarda só metadados (`files`, `storage_rules`, etc.).

> **Segurança:** nunca coloque client secret ou IDs reais no `.env.example` nem commite o `.env`. Se um secret vazou, em **Entra → App → Certificates & secrets** revogue o secret antigo e crie um novo; atualize o host (Vercel) e o seu `.env` local.

---

## 1. Resumo do que você precisa ter pronto

| Onde | O quê |
|------|--------|
| **Microsoft Entra ID** | Um *app registration* com client secret (ou certificado) e permissões de aplicação no Graph |
| **SharePoint Online** | Pelo menos um **site** e uma **biblioteca de documentos** (ex.: `Ocorrencias`); opcionalmente outra biblioteca para portal (`PortalMidia` ou equivalente) |
| **Variáveis de ambiente** | `GRAPH_*`, `SHAREPOINT_*`, `STORAGE_DEFAULT_PROVIDER=sharepoint` no deploy (ex.: Vercel) e no `.env` local |
| **Neon** | `DATABASE_URL` já existente; as tabelas de storage são criadas na primeira chamada às APIs que usam `ensureStorageCatalogTables` |
| **Perfis de usuário** | Para **não** exigir Google no login: use a permissão `auth.storage.microsoft_only` (ou `auth.google_drive.skip`) nos perfis que acessam o sistema |

Arquivos de referência no código: `lib/server/sharepointConfig.ts`, `lib/server/graphAppToken.ts`, `.env.example`.

---

## 2. Variáveis de ambiente (lista oficial)

Defina no **painel do host** (ex.: Vercel → Settings → Environment Variables) e no `.env` local:

| Variável | Obrigatória? | Onde conseguir |
|----------|----------------|----------------|
| `GRAPH_TENANT_ID` | Sim | Microsoft Entra ID → **Overview** do diretório → *Tenant ID* |
| `GRAPH_CLIENT_ID` | Sim | Entra → **App registrations** → seu app → *Application (client) ID* |
| `GRAPH_CLIENT_SECRET` | Sim | Mesmo app → **Certificates & secrets** → *New client secret* (copie na hora; não reaparece) |
| `SHAREPOINT_SITE_ID` | Sim | Ver seção 4 abaixo (Graph ou SharePoint) |
| `SHAREPOINT_DRIVE_ID_OCORRENCIAS` | Sim | ID da **biblioteca** usada para dossiê / ocorrências / anexos operacionais (Graph `.../drives`) |
| `SHAREPOINT_DRIVE_ID_PORTAL` | Não | Se tiver biblioteca separada para mídia do portal; se vazio, o app reutiliza a mesma de `SHAREPOINT_DRIVE_ID_OCORRENCIAS` para regras “portal” |
| `STORAGE_DEFAULT_PROVIDER` | Recomendado | Valor **`sharepoint`** para política oficial só SharePoint (é o padrão lógico se a variável estiver vazia, exceto se você definir `google_drive`) |

**Política “só SharePoint”:** defina `STORAGE_DEFAULT_PROVIDER=sharepoint`, preencha todas as variáveis `GRAPH_*` e `SHAREPOINT_*`, e **não** dependa de `GOOGLE_*` para anexos. Opcionalmente remova ou deixe em branco `GOOGLE_CLIENT_ID`, etc., se não forem usados para outro fim.

---

## 3. Microsoft Entra ID (Azure AD) — app registration

1. Acesse [Entra admin center](https://entra.microsoft.com/) com conta de administrador.
2. **Identity** → **Applications** → **App registrations** → **New registration**.
3. Nome (ex.: `SLE-SharePoint-Storage`), contas: *Accounts in this organizational directory only*.
4. Após criar, anote o **Application (client) ID** → `GRAPH_CLIENT_ID`.
5. **Certificates & secrets** → **New client secret** → copie o valor → `GRAPH_CLIENT_SECRET`.
6. Na página do tenant (Entra **Overview**), copie **Tenant ID** → `GRAPH_TENANT_ID`.

### Permissões da API (Microsoft Graph)

1. No app: **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**.
2. Para começar de forma simples (homologação / alinhamento com TI):
   - **`Sites.ReadWrite.All`** — acesso a sites/drives (amplo; em produção a TI pode exigir escopo menor).
   - Em cenários mais restritos: **`Sites.Selected`** + grant explícito no site (documentação Microsoft: *Permissions for accessing selected sites*).
3. **Grant admin consent** para o diretório (botão “Grant admin consent for …”).

Sem *admin consent*, o token do Graph falha ao acessar o SharePoint.

---

## 4. SharePoint — site, biblioteca e IDs

### 4.1 O que criar (uma vez)

No [SharePoint admin center](https://admin.microsoft.com/) ou no site desejado:

- Crie ou use um **site** (ex.: **Sistema**) dedicado ao sistema.
- Você pode usar **uma única biblioteca** (ex.: **Documentos**) e, dentro dela, **pastas** `Ocorrencias` e `PortalMidia` (como no seu layout). Isso é compatível com o app: o `SHAREPOINT_DRIVE_ID_*` é o ID da **biblioteca** (drive), não da pasta. O código cria subpastas (`Ocorrencias/ano/mês/...`, `PortalMidia/...`) sob a raiz desse drive — se você já criou as pastas de topo com esses nomes, o Graph passa a reutilizá-las ou aninhar dentro delas conforme o template.
- Alternativa mais “enterprise”: **duas bibliotecas de documento** separadas (`Ocorrencias`, `PortalMidia`); aí você obtém **dois** `drive id` diferentes e preenche `SHAREPOINT_DRIVE_ID_OCORRENCIAS` e `SHAREPOINT_DRIVE_ID_PORTAL` com valores distintos.

Subpastas como `Ocorrencias/2026/04/{uuid-do-dossiê}` **não** precisam ser criadas à mão: o backend cria via Graph conforme `storage_rules.path_template`.

### 4.2 Como obter `SHAREPOINT_SITE_ID`

**Opção A — Graph Explorer (recomendado para testar)**

1. Acesse [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) e faça login com conta do tenant.
2. Chame (ajuste host e caminho do site):

   `GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{NomeOuCaminhoDoSite}`

   Exemplo de `hostname`: `suaempresa.sharepoint.com`.  
   O caminho costuma ser o segmento após `/sites/` na URL do site no browser.

3. Na resposta JSON, use o valor **`id`** do site (muitas vezes no formato `hostname,guid1,guid2`) como `SHAREPOINT_SITE_ID` **inteiro**, como retornado pela API.

**Opção B — URL do site**

Se a documentação da Microsoft indicar o formato com vírgulas, use exatamente o `id` retornado pelo Graph, não só um GUID parcial.

### 4.3 Como obter `SHAREPOINT_DRIVE_ID_OCORRENCIAS` (e portal)

1. Com o `SHAREPOINT_SITE_ID` em mãos:

   `GET https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE_ID}/drives`

2. Na lista `value`, cada item tem `id` e `name`. Escolha a biblioteca cujo **name** corresponde à sua biblioteca de ocorrências → copie **`id`** → `SHAREPOINT_DRIVE_ID_OCORRENCIAS`.
3. Se houver biblioteca separada para portal, copie o `id` dela → `SHAREPOINT_DRIVE_ID_PORTAL`.

---

## 5. Neon (banco)

- Garanta `DATABASE_URL` apontando para o projeto Neon.
- Não é necessário rodar SQL manual para as tabelas da Fase 2: o código chama `ensureStorageCatalogTables()` ao usar storage/conteúdo; na primeira execução as tabelas `storage_providers`, `files`, `storage_rules`, `content_items`, etc., são criadas.

Se quiser conferir: após o primeiro upload ou primeiro acesso a `/api/content`, verifique no SQL Editor do Neon o schema `pendencias`.

---

## 6. Aplicação (Vercel ou outro host)

1. Cadastre todas as variáveis da seção 2.
2. Faça **redeploy** após alterar secrets.
3. URL pública: se usar callbacks ou links absolutos, mantenha `NEXT_PUBLIC_APP_URL` coerente com o domínio real.

---

## 7. Perfis e login (sem Google Drive)

- **`auth.storage.microsoft_only`** — perfil que **nunca** abre o fluxo de conexão Google no login (definido em `lib/permissions.ts`; marque no perfil no cadastro de perfis do sistema).
- **`auth.google_drive.skip`** — alternativa já existente (portal só, etc.).
- Com Graph + SharePoint configurados e padrão `sharepoint`, o `AuthContext` também pode **pular** o Google automaticamente quando `/api/storage/status` indica SharePoint configurado como padrão — mesmo assim, para política explícita, use os perfis acima.

Remova ou não exija mais `pendencias.user_tokens` para fluxos que passaram a ser só SharePoint (o upload de dossiê não usa token Google quando o SharePoint está ativo).

---

## 8. Permissão do CMS do portal (conteúdo dinâmico)

- **`portal.gestor.content.manage`** — permite listar/criar/publicar `content_items` e usar `POST /api/files/upload` com `module=portal` (definido em `lib/permissions-fase1-extensions.ts`).
- Atribua a gestores de conteúdo que vão subir banners e campanhas.

---

## 9. Conferência rápida (“está funcionando?”)

1. Login com usuário que tenha acesso ao operacional / portal.
2. `GET /api/storage/status` (autenticado) → `sharepointConfigured: true`, `defaultProviderSharePoint: true`.
3. Anexe um arquivo no dossiê ou use o CMS: o arquivo deve aparecer na biblioteca SharePoint na pasta gerada pelo template (ex.: `Ocorrencias/AAAA/MM/{id}`).
4. Abrir `/api/files/{uuid}/view` no browser (logado) deve exibir/baixar o arquivo.

---

## 10. Problemas comuns

| Sintoma | O que verificar |
|---------|------------------|
| `401` / erro ao obter token Graph | `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`; horário do servidor; secret expirado |
| `403` / access denied no SharePoint | Admin consent; permissões `Sites.ReadWrite.All` ou `Sites.Selected` + grant no site |
| `404` no site/drive | `SHAREPOINT_SITE_ID` e `SHAREPOINT_DRIVE_ID_*` incorretos ou biblioteca renomeada |
| Upload cai no Google | `STORAGE_DEFAULT_PROVIDER` não é `sharepoint` ou variáveis Graph/SharePoint incompletas |
| Login ainda pede Google | Perfil sem `auth.storage.microsoft_only` / `auth.google_drive.skip` e ambiente sem status SharePoint “ok” |

---

## 11. Documentação Microsoft útil

- [Microsoft Graph auth (client credentials)](https://learn.microsoft.com/en-us/graph/auth-v2-service)
- [Upload file to SharePoint via Graph](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content)
- [Get site by path](https://learn.microsoft.com/en-us/graph/api/site-getbypath)
- [List drives](https://learn.microsoft.com/en-us/graph/api/drive-list)

---

*Última revisão alinhada ao código em `lib/server/sharepointConfig.ts` e rotas `app/api/files/*`.*
