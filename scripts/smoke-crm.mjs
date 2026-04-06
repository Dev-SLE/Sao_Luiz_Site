import { access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const checks = [
  "app/api/crm/messages/route.ts",
  "app/api/crm/conversations/route.ts",
  "app/api/crm/sofia/respond/route.ts",
  "app/api/whatsapp/evolution/webhook/route.ts",
  "lib/server/ensureSchema.ts",
];

async function main() {
  for (const rel of checks) {
    const full = path.join(root, rel);
    await access(full);
  }
  // smoke local sem dependências externas: valida presença de rotas críticas
  console.log(`CRM smoke ok (${checks.length} arquivos críticos presentes)`);
}

main().catch((err) => {
  console.error("CRM smoke falhou:", err?.message || err);
  process.exit(1);
});
