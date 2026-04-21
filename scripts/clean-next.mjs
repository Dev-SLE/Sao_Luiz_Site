import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), ".next");
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Removido:", dir);
} catch (e) {
  console.error("Falha ao remover .next (pare o `next dev` e tente de novo):", e?.message || e);
  process.exit(1);
}
