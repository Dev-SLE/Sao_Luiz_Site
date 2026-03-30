import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const appDir = resolve(rootDir, "pendencias-sle-main");
const appNextDir = resolve(appDir, ".next");
const rootNextDir = resolve(rootDir, ".next");

execSync("npm install --include=dev --prefix pendencias-sle-main", {
  stdio: "inherit",
  cwd: rootDir,
});

execSync("npm run build --prefix pendencias-sle-main", {
  stdio: "inherit",
  cwd: rootDir,
});

if (!existsSync(appNextDir)) {
  throw new Error("Build concluido sem gerar pendencias-sle-main/.next");
}

if (existsSync(rootNextDir)) {
  rmSync(rootNextDir, { recursive: true, force: true });
}

cpSync(appNextDir, rootNextDir, { recursive: true });
console.log("Artefato .next copiado para raiz do projeto.");
