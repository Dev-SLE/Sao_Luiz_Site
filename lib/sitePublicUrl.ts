/**
 * URL pública HTTPS do CRM (produção / Vercel), sem barra no fim.
 * Usada em webhooks Evolution e sync — não confundir com EVOLUTION_API_URL (servidor Baileys).
 */
export function getSitePublicBaseUrl(): string {
  const a = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (a) return a.replace(/\/+$/, "");
  const b = process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE?.trim();
  if (b) return b.replace(/\/+$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/\/+$/, "")}`;
  return "";
}
