/**
 * URL e timeouts para chamadas HTTP à Evolution API a partir do servidor (ex.: Vercel).
 * Sem protocolo explícito, assume https:// (evita cair na porta 80 por engano).
 */
function envPositiveInt(name: string, fallback: number): number {
  const raw = String(process.env[name] || "").trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export const EVOLUTION_HTTP_TIMEOUT_MS = envPositiveInt("EVOLUTION_HTTP_TIMEOUT_MS", 25_000);

export type EvolutionFetchOptions = {
  /** Retentativas apenas para GET/HEAD em falhas de rede (não aplica a POST). */
  networkRetries?: number;
  /** Timeout desta chamada específica (ms), com fallback global. */
  timeoutMs?: number;
};

/** Log JSON numa linha (Vercel / aggregators). Não inclua segredos em `fields`. */
export function evolutionIntegrationLog(event: string, fields: Record<string, unknown>) {
  const line = { ts: new Date().toISOString(), scope: "evolution", event, ...fields };
  try {
    console.log(JSON.stringify(line));
  } catch {
    console.log("[evolution]", event, fields);
  }
}

export function redactEvolutionUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "invalid_url";
  }
}

export function normalizeEvolutionServerUrl(raw: string | null | undefined): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  return s;
}

/**
 * fetch com timeout padrão para Evolution (pareamento/QR costuma demorar).
 * GET/HEAD: até `networkRetries` retentativas em erros de rede (ex.: timeout intermitente).
 */
export async function evolutionExternalFetch(
  url: string,
  init: RequestInit = {},
  options?: EvolutionFetchOptions
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const retriesOpt = options?.networkRetries;
  const maxNetworkRetries =
    retriesOpt != null
      ? Math.min(4, Math.max(0, retriesOpt))
      : method === "GET" || method === "HEAD"
        ? 2
        : 0;
  const timeoutMs = Math.min(180_000, Math.max(5_000, Number(options?.timeoutMs || EVOLUTION_HTTP_TIMEOUT_MS)));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxNetworkRetries; attempt++) {
    try {
      const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
      return await fetch(url, { ...init, signal });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt >= maxNetworkRetries || !isEvolutionNetworkError(msg)) {
        evolutionIntegrationLog("fetch_failed", {
          url: redactEvolutionUrl(url),
          method,
          attempt,
          error: msg.slice(0, 300),
        });
        throw e;
      }
      evolutionIntegrationLog("fetch_retry", {
        url: redactEvolutionUrl(url),
        method,
        attempt,
        error: msg.slice(0, 200),
      });
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastErr;
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
