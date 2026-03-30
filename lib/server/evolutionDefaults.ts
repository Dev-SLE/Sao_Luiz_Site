/**
 * Credenciais globais da Evolution (um servidor para todas as caixas "modo simples").
 * Preencha EVOLUTION_API_URL + EVOLUTION_API_KEY no .env / Vercel — usuários finais não digitam URL/chave.
 */
export function getEvolutionServerDefaults(): { serverUrl: string; apiKey: string } | null {
  const serverUrl = String(
    process.env.EVOLUTION_API_URL || process.env.EVOLUTION_DEFAULT_SERVER_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");
  const apiKey = String(process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_DEFAULT_API_KEY || "").trim();
  if (!serverUrl || !apiKey) return null;
  return { serverUrl, apiKey };
}

export function slugifyInstancePart(raw: string): string {
  const s = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s.slice(0, 32) || "linha";
}
