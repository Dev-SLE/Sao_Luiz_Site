import { evolutionExternalFetch, evolutionIntegrationLog, normalizeEvolutionServerUrl } from "./evolutionUrl";
import { getSitePublicBaseUrl } from "../sitePublicUrl";

export type EvolutionWebhookSyncResult = {
  ok: boolean;
  error?: string;
  httpStatus?: number;
  webhookUrl?: string;
  endpoint?: string;
  evolution?: unknown;
  lastBodySnippet?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Conjuntos de eventos (do mais compatível ao mais completo).
 * A doc OpenAPI v2 lista MESSAGES_SET mas não MESSAGES_EDITED — alguns deploys rejeitam eventos desconhecidos e não gravam nada no Manager.
 */
const WEBHOOK_EVENT_SETS: string[][] = [
  ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"],
  ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_SET"],
  [
    "QRCODE_UPDATED",
    "CONNECTION_UPDATE",
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "MESSAGES_SET",
    "MESSAGES_EDITED",
  ],
];

function buildPublicWebhookUrl(publicBaseOverride?: string): { webhookUrl: string } | { error: string } {
  const token = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  const publicBase = (publicBaseOverride?.trim() || getSitePublicBaseUrl() || "").replace(/\/+$/, "");
  if (!publicBase) {
    return {
      error:
        "Defina NEXT_PUBLIC_APP_URL ou EVOLUTION_WEBHOOK_PUBLIC_BASE na Vercel para montar a URL do webhook.",
    };
  }
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const webhookUrl = `${publicBase}/api/whatsapp/evolution/webhook${qs}`;
  return { webhookUrl };
}

type Attempt = { method: "POST" | "PUT"; url: string; body: Record<string, unknown> };

function buildAttempts(base: string, instance: string, webhookUrl: string, events: string[]): Attempt[] {
  const camel = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events,
  };
  const snake = {
    enabled: true,
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: true,
    events,
  };
  const nested = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events,
    },
  };
  const enc = encodeURIComponent(instance);
  return [
    { method: "POST", url: `${base}/webhook/set/${enc}`, body: camel },
    { method: "POST", url: `${base}/webhook/set/${enc}`, body: snake },
    { method: "POST", url: `${base}/webhook/set/${enc}`, body: nested },
    { method: "PUT", url: `${base}/webhook/set/${enc}`, body: camel },
    { method: "PUT", url: `${base}/webhook/set/${enc}`, body: snake },
    { method: "PUT", url: `${base}/webhook/set/${enc}`, body: nested },
  ];
}

/**
 * Uma passagem completa de POST/PUT /webhook/set/… (vários formatos de body + conjuntos de eventos).
 */
async function syncEvolutionInstanceWebhookAttempts(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
  publicBaseOverride?: string;
}): Promise<EvolutionWebhookSyncResult> {
  const instance = String(args.instance || "").trim();
  if (!instance) return { ok: false, error: "Nome da instância vazio" };

  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base) return { ok: false, error: "URL do servidor Evolution inválida" };

  const apiKey = String(args.apiKey || "").trim();
  if (!apiKey) return { ok: false, error: "Chave API da Evolution ausente" };

  const wb = buildPublicWebhookUrl(args.publicBaseOverride);
  if ("error" in wb) return { ok: false, error: wb.error };
  const { webhookUrl } = wb;

  const token = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  if (!token && String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    console.warn("[evolution-webhook-sync] EVOLUTION_WEBHOOK_TOKEN vazio — webhook sem ?token= (401 no CRM).");
  }

  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
    accept: "application/json",
  };

  let lastStatus = 0;
  let lastBody = "";
  let lastEvolution: unknown = null;

  /** Instância recém-criada às vezes ignora o 1.º set; 3 rodadas com pausa reduzem falhas intermitentes. */
  const rounds = 3;
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await sleep(1500);

    for (const events of WEBHOOK_EVENT_SETS) {
      const attempts = buildAttempts(base, instance, webhookUrl, events);
      for (const { method, url, body } of attempts) {
        try {
          const r = await evolutionExternalFetch(url, {
            method,
            headers,
            body: JSON.stringify(body),
          });
          const text = await r.text();
          lastStatus = r.status;
          lastBody = text.slice(0, 1200);
          try {
            lastEvolution = JSON.parse(text);
          } catch {
            lastEvolution = { raw: text };
          }
          if (r.ok) {
            return {
              ok: true,
              httpStatus: r.status,
              webhookUrl,
              endpoint: `${method} ${url}`,
              evolution: lastEvolution,
            };
          }
        } catch (e: any) {
          lastBody = e?.message || String(e);
          lastStatus = 0;
        }
      }
    }
  }

  evolutionIntegrationLog("webhook_sync_exhausted", {
    instance,
    lastStatus,
    snippet: lastBody.slice(0, 400),
  });

  return {
    ok: false,
    error: `A Evolution não aceitou a configuração do webhook (último HTTP ${lastStatus || "—"}). Se aparecer "Cannot POST /webhook/set", revise a versão da Evolution/API exposta. Resposta: ${lastBody.slice(0, 180)}`,
    httpStatus: lastStatus,
    webhookUrl,
    evolution: lastEvolution,
    lastBodySnippet: lastBody,
  };
}

/**
 * Grava webhook na Evolution (URL com token + eventos CRM + Base64), com retry e reforço automático.
 * Usado na criação de caixas, pareamento e sync manual.
 */
export async function syncEvolutionInstanceWebhook(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
  /** Ex.: dev com `publicBase` na query — senão usa getSitePublicBaseUrl(). */
  publicBaseOverride?: string;
}): Promise<EvolutionWebhookSyncResult> {
  let result = await syncEvolutionInstanceWebhookAttempts(args);
  if (!result.ok) {
    await sleep(2000);
    result = await syncEvolutionInstanceWebhookAttempts(args);
  }
  if (result.ok) {
    await sleep(900);
    const reinforce = await syncEvolutionInstanceWebhookAttempts(args);
    if (!reinforce.ok) {
      evolutionIntegrationLog("webhook_reinforce_failed", {
        instance: String(args.instance || "").trim(),
        httpStatus: reinforce.httpStatus,
        error: String(reinforce.error || "").slice(0, 240),
      });
    }
  }
  return result;
}
