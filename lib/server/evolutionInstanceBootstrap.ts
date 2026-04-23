import { evolutionExternalFetch, evolutionIntegrationLog, normalizeEvolutionServerUrl } from "./evolutionUrl";

export type EvolutionSettingsSyncResult = {
  ok: boolean;
  error?: string;
  httpStatus?: number;
  endpoint?: string;
  /** Valores efetivamente enviados (camelCase da API). */
  applied?: Record<string, unknown>;
  evolution?: unknown;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickBool(obj: Record<string, unknown> | null | undefined, camel: string, snake: string): boolean | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const v = (obj as any)[camel];
  if (typeof v === "boolean") return v;
  const s = (obj as any)[snake];
  if (typeof s === "boolean") return s;
  return undefined;
}

function pickStr(obj: Record<string, unknown> | null | undefined, camel: string, snake: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const v = (obj as any)[camel];
  if (typeof v === "string") return v;
  const s = (obj as any)[snake];
  if (typeof s === "string") return s;
  return undefined;
}

/** Extrai objeto de settings da resposta GET /settings/find/{instance} (formatos variam por versão). */
function unwrapSettingsFindJson(json: any): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const j = json as Record<string, unknown>;
  if (j.settings && typeof j.settings === "object") return j.settings as Record<string, unknown>;
  if (j.data && typeof j.data === "object") return unwrapSettingsFindJson(j.data);
  if (Array.isArray(j) && j[0] && typeof j[0] === "object") return unwrapSettingsFindJson(j[0]);
  return j;
}

/**
 * Ajusta opções da instância Evolution para o fluxo CRM (mídia + getBase64).
 * Não altera DATABASE_* no servidor Evolution (só .env do deploy); isso continua sendo TI.
 *
 * - Garante **readStatus** (ver status / stories) — recomendado pela Evolution para mídia e getBase64.
 * - Mantém demais flags a partir do que já está na instância, com padrões seguros.
 */
export async function syncEvolutionInstanceSettingsForCrm(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
}): Promise<EvolutionSettingsSyncResult> {
  const instance = String(args.instance || "").trim();
  if (!instance) return { ok: false, error: "Nome da instância vazio" };

  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base) return { ok: false, error: "URL do servidor Evolution inválida" };

  const apiKey = String(args.apiKey || "").trim();
  if (!apiKey) return { ok: false, error: "Chave API da Evolution ausente" };

  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
    accept: "application/json",
  };

  let current: Record<string, unknown> = {};
  try {
    const findUrl = `${base}/settings/find/${encodeURIComponent(instance)}`;
    const fr = await evolutionExternalFetch(findUrl, { method: "GET", headers });
    const fj = await fr.json().catch(() => ({}));
    if (fr.ok) {
      current = unwrapSettingsFindJson(fj);
    }
  } catch {
    current = {};
  }

  const rejectCall = pickBool(current, "rejectCall", "reject_call") ?? true;
  const groupsIgnore = pickBool(current, "groupsIgnore", "groups_ignore") ?? true;
  const alwaysOnline = pickBool(current, "alwaysOnline", "always_online") ?? true;
  const readMessages = pickBool(current, "readMessages", "read_messages") ?? false;
  const syncFullHistory = pickBool(current, "syncFullHistory", "sync_full_history") ?? false;
  const msgCall = pickStr(current, "msgCall", "msg_call") ?? "";

  const body = {
    rejectCall,
    groupsIgnore,
    alwaysOnline,
    readMessages,
    /** CRM mídia: necessário para baixar mídia de status e cenários cobertos pela Evolution. */
    readStatus: true,
    syncFullHistory,
    msgCall,
  };

  const url = `${base}/settings/set/${encodeURIComponent(instance)}`;
  const snakeBody = {
    reject_call: body.rejectCall,
    groups_ignore: body.groupsIgnore,
    always_online: body.alwaysOnline,
    read_messages: body.readMessages,
    read_status: body.readStatus,
    sync_full_history: body.syncFullHistory,
    msg_call: body.msgCall,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) await sleep(600);
    for (const payload of [body, snakeBody]) {
      try {
        const r = await evolutionExternalFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        let evolution: unknown = null;
        try {
          evolution = JSON.parse(text);
        } catch {
          evolution = { raw: text };
        }
        if (r.ok) {
          return {
            ok: true,
            httpStatus: r.status,
            endpoint: `POST ${url}`,
            applied: body,
            evolution,
          };
        }
        evolutionIntegrationLog("settings_set_rejected", {
          instance,
          httpStatus: r.status,
          snippet: text.slice(0, 400),
        });
      } catch (e: any) {
        evolutionIntegrationLog("settings_set_error", { instance, error: String(e?.message || e).slice(0, 240) });
      }
    }
  }

  return {
    ok: false,
    error:
      "A Evolution não aceitou /settings/set (versão ou permissão da API). Mídia pode exigir ajuste manual no Manager (ex.: ler status).",
    applied: body,
  };
}
