/**
 * Testa token Microsoft Graph + leitura da raiz do drive SharePoint (sem imprimir segredos).
 * Uso: node scripts/test-sharepoint-graph.mjs
 * Lê .env na raiz (mesmo formato que check-sharepoint-env.mjs).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());
const envPath = resolve(root, ".env");

function parseEnvFile(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    const hash = val.indexOf(" #");
    if (hash >= 0) val = val.slice(0, hash).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function getToken(env) {
  const tenant = String(env.GRAPH_TENANT_ID || "").trim();
  const clientId = String(env.GRAPH_CLIENT_ID || "").trim();
  const clientSecret = String(env.GRAPH_CLIENT_SECRET || "").trim();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Token Graph: ${msg}`);
  }
  return json.access_token;
}

async function main() {
  if (!existsSync(envPath)) {
    console.error("Arquivo .env não encontrado.");
    process.exit(1);
  }
  const env = parseEnvFile(readFileSync(envPath, "utf8"));
  const siteId = String(env.SHAREPOINT_SITE_ID || "").trim();
  const drivePortal = String(env.SHAREPOINT_DRIVE_ID_PORTAL || "").trim();
  const driveOcc = String(env.SHAREPOINT_DRIVE_ID_OCORRENCIAS || "").trim();
  const driveId = drivePortal || driveOcc;

  for (const k of ["GRAPH_TENANT_ID", "GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET", "SHAREPOINT_SITE_ID", "SHAREPOINT_DRIVE_ID_OCORRENCIAS"]) {
    if (!String(env[k] || "").trim()) {
      console.error(`Falta ${k} no .env`);
      process.exit(1);
    }
  }

  console.log("1) Obtendo token de aplicação (client credentials)…");
  const token = await getToken(env);
  console.log("   OK — token recebido.\n");

  const encSite = encodeURIComponent(siteId);
  const encDrive = encodeURIComponent(driveId);
  const url = `https://graph.microsoft.com/v1.0/sites/${encSite}/drives/${encDrive}/root?$select=id,name,webUrl,folder`;

  console.log(`2) GET drive root (site + drive usados pelo portal quando há PORTAL, senão o de ocorrências)…`);
  console.log(`   drive_id testado: ${drivePortal ? "SHAREPOINT_DRIVE_ID_PORTAL" : "SHAREPOINT_DRIVE_ID_OCORRENCIAS"}\n`);

  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = null;
  }

  if (!r.ok) {
    console.error(`   FALHA HTTP ${r.status}`);
    console.error(text.slice(0, 800));
    process.exit(1);
  }

  console.log("   OK — Graph respondeu.");
  console.log(`   Pasta raiz do drive: name="${j?.name}" id=${j?.id?.slice(0, 8)}…`);
  if (j?.webUrl) console.log(`   webUrl: ${j.webUrl}`);

  console.log("\n3) Sobre criação de subpastas (PortalMidia/…):");
  console.log("   Elas NÃO são criadas só ao iniciar o Next.js.");
  console.log("   São criadas automaticamente no primeiro upload que precisar daquele caminho");
  console.log("   (a API chama ensureFolderPath segmento a segmento antes de enviar o arquivo).\n");

  process.exit(0);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
