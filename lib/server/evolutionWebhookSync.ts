import { evolutionExternalFetch, evolutionIntegrationLog, normalizeEvolutionServerUrl } from "./evolutionUrl";
import { getSitePublicBaseUrl } from "../sitePublicUrl";
import { maskEvolutionWebhookUrlForLog } from "./crmEvolutionDebug";

export type EvolutionWebhookSyncResult = {
  ok: boolean;
  error?: string;
  httpStatus?: number;
  webhookUrl?: string;
  /** URL com `?token=` mascarado — seguro para UI/logs. */
  webhookUrlMasked?: string;
  /** Origem do segredo na query (sempre env do deploy). */
  webhookTokenSource?: string;
  endpoint?: string;
  evolution?: unknown;
  lastBodySnippet?: string;
  /** Eventos enviados no `webhook/set` que obteve sucesso. */
  eventsApplied?: string[];
  /** GET /webhook/find após set bem-sucedido (quando aplicável). */
  webhookReadback?: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Conjuntos de eventos: 1.º tenta incluir DELETE + EDITED + SEND_MESSAGE (algumas builds Evolution); se rejeitar, cai para conjuntos menores.
 */
const WEBHOOK_EVENT_SETS: string[][] = [
  [
    "QRCODE_UPDATED",
    "CONNECTION_UPDATE",
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "MESSAGES_DELETE",
    "MESSAGES_EDITED",
    "MESSAGES_SET",
    "SEND_MESSAGE",
  ],
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

/**
 * Conjunto único para “resync forçado” pelo CRM (máx. eventos de mensagem/mídia suportados pela API v2).
 * Se a Evolution devolver 400, o handler de resync pode cair para `WEBHOOK_EVENT_SETS` normal.
 */
export const WEBHOOK_EVENT_SETS_FORCE_RESYNC: string[][] = [
  [
    "QRCODE_UPDATED",
    "CONNECTION_UPDATE",
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "MESSAGES_DELETE",
    "MESSAGES_EDITED",
    "MESSAGES_SET",
    "SEND_MESSAGE",
    "CHATS_UPSERT",
    "CHATS_UPDATE",
    "CONTACTS_UPSERT",
    "PRESENCE_UPDATE",
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

/** GET /webhook/find/{instance} — confirma URL, enabled, events e (se existir) base64 na instância. */
export async function fetchEvolutionWebhookFind(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
}): Promise<{ ok: boolean; httpStatus: number; json: unknown }> {
  const instance = String(args.instance || "").trim();
  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  const apiKey = String(args.apiKey || "").trim();
  if (!instance || !base || !apiKey) {
    return { ok: false, httpStatus: 0, json: { error: "parametros_ausentes" } };
  }
  const url = `${base}/webhook/find/${encodeURIComponent(instance)}`;
  try {
    const r = await evolutionExternalFetch(url, {
      method: "GET",
      headers: { apikey: apiKey, accept: "application/json" },
    });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 800) };
    }
    return { ok: r.ok, httpStatus: r.status, json };
  } catch (e: any) {
    return { ok: false, httpStatus: 0, json: { error: String(e?.message || e).slice(0, 400) } };
  }
}

/**
 * Uma passagem completa de POST/PUT /webhook/set/… (vários formatos de body + conjuntos de eventos).
 */
async function syncEvolutionInstanceWebhookAttempts(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
  publicBaseOverride?: string;
  /** Se definido, usa estes conjuntos em vez de `WEBHOOK_EVENT_SETS`. */
  eventSets?: string[][];
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

  const eventSetsToUse = args.eventSets?.length ? args.eventSets : WEBHOOK_EVENT_SETS;

  /** Instância recém-criada às vezes ignora o 1.º set; 3 rodadas com pausa reduzem falhas intermitentes. */
  const rounds = 3;
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await sleep(1500);

    for (const events of eventSetsToUse) {
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
            const webhookUrlMasked = maskEvolutionWebhookUrlForLog(webhookUrl);
            try {
              const origin = new URL(webhookUrl).origin;
              console.info("[evolution-webhook-sync] applied", {
                instance,
                endpoint: `${method} ${url}`,
                httpStatus: r.status,
                publicBase: origin,
                webhookUrlMasked,
                webhookBase64: true,
                webhookByEvents: false,
                events,
                evolutionResponseSnippet: typeof lastBody === "string" ? lastBody.slice(0, 320) : "",
              });
            } catch {
              console.info("[evolution-webhook-sync] applied", {
                instance,
                endpoint: `${method} ${url}`,
                httpStatus: r.status,
                webhookUrlMasked,
                events,
              });
            }
            return {
              ok: true,
              httpStatus: r.status,
              webhookUrl,
              webhookUrlMasked,
              webhookTokenSource: "env:EVOLUTION_WEBHOOK_TOKEN",
              endpoint: `${method} ${url}`,
              evolution: lastEvolution,
              eventsApplied: [...events],
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
  /** Conjuntos de eventos alternativos (ex.: `WEBHOOK_EVENT_SETS_FORCE_RESYNC`). */
  eventSets?: string[][];
}): Promise<EvolutionWebhookSyncResult> {
  const attemptArgs = {
    serverUrl: args.serverUrl,
    apiKey: args.apiKey,
    instance: args.instance,
    publicBaseOverride: args.publicBaseOverride,
    eventSets: args.eventSets,
  };
  let result = await syncEvolutionInstanceWebhookAttempts(attemptArgs);
  if (!result.ok) {
    await sleep(2000);
    result = await syncEvolutionInstanceWebhookAttempts(attemptArgs);
  }
  if (result.ok) {
    await sleep(900);
    const reinforce = await syncEvolutionInstanceWebhookAttempts(attemptArgs);
    if (!reinforce.ok) {
      evolutionIntegrationLog("webhook_reinforce_failed", {
        instance: String(args.instance || "").trim(),
        httpStatus: reinforce.httpStatus,
        error: String(reinforce.error || "").slice(0, 240),
      });
    }
    try {
      const read = await fetchEvolutionWebhookFind({
        serverUrl: args.serverUrl,
        apiKey: args.apiKey,
        instance: String(args.instance || "").trim(),
      });
      const j = read.json as Record<string, unknown> | null;
      const nestedWh = j?.webhook as Record<string, unknown> | undefined;
      const urlMask =
        typeof j?.url === "string" ? maskEvolutionWebhookUrlForLog(j.url as string) : j?.url ?? null;
      console.info("[evolution-webhook-sync] verify_readback", {
        instance: String(args.instance || "").trim(),
        httpStatus: read.httpStatus,
        ok: read.ok,
        enabled: j?.enabled ?? nestedWh?.enabled ?? null,
        webhookByEvents: j?.webhookByEvents ?? j?.webhook_by_events ?? nestedWh?.byEvents ?? null,
        webhookBase64: j?.webhookBase64 ?? j?.webhook_base64 ?? nestedWh?.base64 ?? null,
        urlMasked: urlMask,
        events: Array.isArray(j?.events) ? (j!.events as string[]).slice(0, 40) : j?.events ?? null,
      });
      result = { ...result, webhookReadback: read.json };
    } catch (e: any) {
      evolutionIntegrationLog("webhook_find_failed", {
        instance: String(args.instance || "").trim(),
        error: String(e?.message || e).slice(0, 200),
      });
    }
  }
  return result;
}
