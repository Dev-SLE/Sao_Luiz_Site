/**
 * Guarda o último QR recebido via webhook QRCODE_UPDATED (memória; só processo dev).
 * O GET /instance/connect da Evolution v2.2.x costuma retornar só { count: 0 }.
 */

type Entry = { base64: string; receivedAt: number };

const store = new Map<string, Entry>();
const TTL_MS = 8 * 60 * 1000;

function keyFor(instance: string) {
  return String(instance || "").trim().toLowerCase();
}

function extractBase64(data: any): string | null {
  if (data == null) return null;
  if (typeof data === "string") {
    const s = data.trim();
    if (s.startsWith("data:image")) return s;
    if (s.length > 200 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 500))) {
      return `data:image/png;base64,${s}`;
    }
    return null;
  }
  const d = data as Record<string, unknown>;
  const inner = (d.qrcode as any)?.base64 ?? d.base64 ?? d.qr ?? (d.qrcode as string);
  if (typeof inner === "string") {
    const s = inner.trim();
    if (s.startsWith("data:image")) return s;
    if (s.length > 50) return `data:image/png;base64,${s}`;
  }
  return null;
}

/** Evolution manda estruturas diferentes; varre poucos níveis. */
function deepFindQrBase64(obj: any, depth = 0, parentKey?: string): string | null {
  if (depth > 8 || obj == null) return null;
  // Base64 de mídia WhatsApp (imageMessage etc.) não é QR — evita falso positivo fora da rota webhook.
  if (
    parentKey &&
    /^(imageMessage|audioMessage|videoMessage|documentMessage|stickerMessage|pttMessage|ptvMessage)$/i.test(parentKey)
  ) {
    return null;
  }
  const tryOne = extractBase64(obj);
  if (tryOne) return tryOne;
  if (typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const f = deepFindQrBase64(item, depth + 1, parentKey);
      if (f) return f;
    }
    return null;
  }
  for (const [k, v] of Object.entries(obj)) {
    const f = deepFindQrBase64(v, depth + 1, k);
    if (f) return f;
  }
  return null;
}

export function evolutionQrCaptureFromWebhook(instance: string, bodyData: any) {
  const k = keyFor(instance);
  if (!k) return false;
  const b64 =
    extractBase64(bodyData) ??
    extractBase64(bodyData?.qrcode) ??
    deepFindQrBase64(bodyData);
  if (!b64) return false;
  store.set(k, { base64: b64, receivedAt: Date.now() });
  return true;
}

/** Quando o proxy REST achar base64 (fetchInstances/connect), grava para /qr-last. */
export function evolutionQrStoreFromRest(instance: string, rawBase64OrDataUrl: string) {
  const k = keyFor(instance);
  if (!k || !rawBase64OrDataUrl) return false;
  let b64 = String(rawBase64OrDataUrl).trim();
  if (!b64.startsWith("data:image")) {
    if (b64.length < 80) return false;
    b64 = `data:image/png;base64,${b64}`;
  }
  store.set(k, { base64: b64, receivedAt: Date.now() });
  return true;
}

export function evolutionQrGetLast(instance: string): { base64: string; ageMs: number } | null {
  const k = keyFor(instance);
  if (!k) return null;
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() - e.receivedAt > TTL_MS) {
    store.delete(k);
    return null;
  }
  return { base64: e.base64, ageMs: Date.now() - e.receivedAt };
}
