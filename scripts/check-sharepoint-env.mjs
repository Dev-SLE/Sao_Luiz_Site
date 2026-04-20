/**
 * Verifica variáveis mínimas para SharePoint sem imprimir segredos.
 * Uso: node scripts/check-sharepoint-env.mjs
 * Carrega .env na raiz do projeto (linhas KEY=valor).
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

function mask(v) {
  if (!v) return "(vazio)";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)} (${v.length} chars)`;
}

const required = [
  "DATABASE_URL",
  "GRAPH_TENANT_ID",
  "GRAPH_CLIENT_ID",
  "GRAPH_CLIENT_SECRET",
  "SHAREPOINT_SITE_ID",
  "SHAREPOINT_DRIVE_ID_OCORRENCIAS",
];

if (!existsSync(envPath)) {
  console.error("Arquivo .env não encontrado na raiz do projeto.");
  console.error("Copie .env.example para .env e preencha os valores.");
  process.exit(1);
}

const env = parseEnvFile(readFileSync(envPath, "utf8"));
let ok = true;

console.log("Verificação de variáveis (valores sensíveis mascarados):\n");

for (const key of required) {
  const v = String(env[key] || "").trim();
  const present = !!v;
  if (!present) ok = false;
  console.log(`  ${present ? "OK" : "FALTA"}  ${key}  ${present ? mask(v) : ""}`);
}

const portalDrive = String(env.SHAREPOINT_DRIVE_ID_PORTAL || "").trim();
const occDrive = String(env.SHAREPOINT_DRIVE_ID_OCORRENCIAS || "").trim();
if (portalDrive) {
  const same = portalDrive === occDrive;
  console.log(`\n  SHAREPOINT_DRIVE_ID_PORTAL  ${same ? "(igual ao de ocorrências — OK para uma biblioteca com duas pastas)" : mask(portalDrive)}`);
} else {
  console.log("\n  SHAREPOINT_DRIVE_ID_PORTAL  (vazio — app usa o mesmo drive de ocorrências)");
}

const prov = String(env.STORAGE_DEFAULT_PROVIDER || "sharepoint").toLowerCase();
console.log(`\n  STORAGE_DEFAULT_PROVIDER  ${prov || "(default sharepoint)"}`);

if (!ok) {
  console.error("\nPreencha as variáveis faltantes no .env.");
  process.exit(1);
}

console.log("\nPróximo passo: obter token Graph (só em diagnóstico) ou testar upload pelo app após login.");
console.log("Ex.: POST /api/files/upload com cookie de sessão + multipart (module, entity, entity_id, file).");
process.exit(0);
