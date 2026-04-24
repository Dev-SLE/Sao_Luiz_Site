import crypto from "crypto";
import { getSitePublicBaseUrl } from "../sitePublicUrl";

/** Razões pelas quais não há URL assinada (para logs; sem valores sensíveis). */
export function evolutionSignedMediaFetchMissing(): string[] {
  const missing: string[] = [];
  if (!String(process.env.FILES_EVOLUTION_DOWNLOAD_SECRET || "").trim()) {
    missing.push("FILES_EVOLUTION_DOWNLOAD_SECRET");
  }
  if (!getSitePublicBaseUrl().trim()) {
    missing.push("NEXT_PUBLIC_APP_URL_or_EVOLUTION_WEBHOOK_PUBLIC_BASE_or_VERCEL_URL");
  }
  return missing;
}

/** Segredo HMAC + base pública; se vazio, mantém-se data URI no sendMedia. */
export function buildSignedEvolutionMediaFetchUrl(fileId: string): string | null {
  const secret = String(process.env.FILES_EVOLUTION_DOWNLOAD_SECRET || "").trim();
  const base = getSitePublicBaseUrl().replace(/\/+$/, "");
  if (!secret || !base || !fileId) return null;
  const t = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(`${fileId}:${t}`).digest("hex");
  const qs = new URLSearchParams({ t, s: sig });
  return `${base}/api/crm/evolution-media/${encodeURIComponent(fileId)}?${qs.toString()}`;
}
