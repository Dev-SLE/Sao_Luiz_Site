/**
 * URL e timeouts para chamadas HTTP à Evolution API a partir do servidor (ex.: Vercel).
 * Sem protocolo explícito, assume https:// (evita cair na porta 80 por engano).
 */
export const EVOLUTION_HTTP_TIMEOUT_MS = 25_000;

export function normalizeEvolutionServerUrl(raw: string | null | undefined): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  return s;
}

/** fetch com timeout padrão para Evolution (pareamento/QR costuma demorar). */
export async function evolutionExternalFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal ?? AbortSignal.timeout(EVOLUTION_HTTP_TIMEOUT_MS);
  return fetch(url, { ...init, signal });
}

export const EVOLUTION_CONNECTION_USER_MESSAGE =
  "Erro de conexão: O servidor da Evolution demorou a responder. Verifique se a URL e a porta estão corretas.";

export function isEvolutionNetworkError(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("etimedout") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("aborted") ||
    m.includes("connect timeout") ||
    (m.includes("socket") && m.includes("hang"))
  );
}
