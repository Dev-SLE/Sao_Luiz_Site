/**
 * Valida env para GET público /api/crm/evolution-media (Evolution → CRM).
 * Uso:
 *   node scripts/check-evolution-media-reachability.mjs
 *   node scripts/check-evolution-media-reachability.mjs <fileId-uuid>
 * Com fileId: faz GET assinado a partir de NEXT_PUBLIC_APP_URL (ou EVOLUTION_WEBHOOK_PUBLIC_BASE / VERCEL_URL).
 * Na máquina onde corre a Evolution, use o mesmo URL num `curl -I "..."` para confirmar TLS/rota.
 */
import crypto from "crypto";

function publicBase() {
  const a = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (a) return a.replace(/\/+$/, "");
  const b = String(process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE || "").trim();
  if (b) return b.replace(/\/+$/, "");
  const v = String(process.env.VERCEL_URL || "").trim();
  if (v) return `https://${v.replace(/\/+$/, "")}`;
  return "";
}

function main() {
  const secret = String(process.env.FILES_EVOLUTION_DOWNLOAD_SECRET || "").trim();
  const base = publicBase();
  const fileId = process.argv[2]?.trim();

  console.log("[check-evolution-media-reachability] Base pública:", base || "(vazia)");
  console.log("[check-evolution-media-reachability] FILES_EVOLUTION_DOWNLOAD_SECRET:", secret ? "definido" : "AUSENTE");

  if (!secret || !base) {
    console.error(
      "\nConfigure FILES_EVOLUTION_DOWNLOAD_SECRET e NEXT_PUBLIC_APP_URL (ou EVOLUTION_WEBHOOK_PUBLIC_BASE).\n" +
        "Na VPS Evolution: curl -I \"https://<MESMO_HOST>/api/crm/evolution-media/<fileId>?t=...&s=...\"\n" +
        "deve devolver 200 (ou 401 só se assinatura errada/expirada).\n" +
        "Desative Vercel Deployment Protection se o GET anónimo for bloqueado antes da função.\n"
    );
    process.exit(1);
  }

  if (!fileId) {
    console.log(
      "\nOpcional: passe um fileId para testar GET assinado a partir deste ambiente:\n" +
        "  node scripts/check-evolution-media-reachability.mjs <uuid>\n"
    );
    process.exit(0);
  }

  const t = String(Date.now());
  const s = crypto.createHmac("sha256", secret).update(`${fileId}:${t}`).digest("hex");
  const qs = new URLSearchParams({ t, s }).toString();
  const url = `${base}/api/crm/evolution-media/${encodeURIComponent(fileId)}?${qs}`;

  console.log("\nGET (primeiros 120 chars da URL):", url.slice(0, 120) + "...");

  fetch(url, { method: "GET", redirect: "follow" })
    .then((r) => {
      console.log("HTTP:", r.status, r.statusText);
      if (!r.ok) {
        console.error("Falha: Evolution ou operador precisam conseguir o mesmo 200 a partir do host público.");
        process.exit(1);
      }
      console.log("OK: URL assinada respondeu. Confirme o mesmo a partir do host da Evolution (curl).");
    })
    .catch((e) => {
      console.error("Erro de rede:", e?.message || e);
      process.exit(1);
    });
}

main();
