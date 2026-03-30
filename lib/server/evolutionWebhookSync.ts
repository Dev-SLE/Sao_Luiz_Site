import { evolutionExternalFetch, normalizeEvolutionServerUrl } from "./evolutionUrl";
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

type Attempt = { url: string; body: Record<string, unknown> };

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
  const enc = encodeURIComponent(instance);
  return [
    { url: `${base}/webhook/set/${enc}`, body: camel },
    { url: `${base}/webhook/set`, body: { ...camel, instanceName: instance } },
    { url: `${base}/webhook/set/${enc}`, body: snake },
    { url: `${base}/webhook/set`, body: { ...snake, instanceName: instance } },
  ];
}

/**
 * Grava webhook na Evolution (POST /webhook/set/...) com retries — usado no modo rápido e no pareamento.
 */
export async function syncEvolutionInstanceWebhook(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
  /** Ex.: dev com `publicBase` na query — senão usa getSitePublicBaseUrl(). */
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

  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
    accept: "application/json",
  };

  let lastStatus = 0;
  let lastBody = "";
  let lastEvolution: unknown = null;

  /** 2 rodadas cobrem instância recém-criada; mais chamadas aumentam risco de timeout na Vercel. */
  const rounds = 2;
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await sleep(1200);

    for (const events of WEBHOOK_EVENT_SETS) {
      const attempts = buildAttempts(base, instance, webhookUrl, events);
      for (const { url, body } of attempts) {
        try {
          const r = await evolutionExternalFetch(url, {
            method: "POST",
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
              endpoint: url,
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

  console.error("[evolution-webhook-sync] todas as tentativas falharam", {
    instance,
    lastStatus,
    snippet: lastBody.slice(0, 400),
  });

  return {
    ok: false,
    error: `A Evolution não aceitou a configuração do webhook (último HTTP ${lastStatus || "—"}). Confira instância, chave e logs do servidor Evolution. Resposta: ${lastBody.slice(0, 180)}`,
    httpStatus: lastStatus,
    webhookUrl,
    evolution: lastEvolution,
    lastBodySnippet: lastBody,
  };
}
