import { evolutionQrStoreFromRest } from "./evolutionLastQr";

export function mergeEvolutionQr(connectBody: any, fetchBody: any): any {
  const out = connectBody && typeof connectBody === "object" ? { ...connectBody } : {};
  const tryExtract = (node: any): string | null => {
    if (!node || typeof node !== "object") return null;
    const q = node.qrcode ?? node.qrCode;
    if (q && typeof q === "object" && typeof (q as any).base64 === "string") return (q as any).base64;
    if (typeof (node as any).base64 === "string" && (node as any).base64.length > 80) return (node as any).base64;
    return null;
  };
  let found = tryExtract(out);
  if (!found && fetchBody) {
    const walk = (o: any, d = 0): string | null => {
      if (d > 10 || !o || typeof o !== "object") return null;
      const t = tryExtract(o);
      if (t) return t;
      for (const v of Object.values(o)) {
        const x = walk(v, d + 1);
        if (x) return x;
      }
      return null;
    };
    found = walk(fetchBody);
  }
  if (found && !out.base64 && !(out.qrcode as any)?.base64) {
    out.base64 = found.startsWith("data:") ? found : `data:image/png;base64,${found}`;
    out._mergedQrFrom = "fetchInstances";
  }
  return out;
}

/**
 * GET /instance/connect + fetchInstances — mesma lógica do connect-proxy, com credenciais explícitas.
 */
export async function runEvolutionConnect(args: {
  baseUrl: string;
  apiKey: string;
  instance: string;
  numberDigits?: string | null;
}): Promise<{
  httpStatus: number;
  evolution: any;
  fetchInstancesBody: any;
}> {
  const base = args.baseUrl.replace(/\/+$/, "");
  const inst = String(args.instance).trim();
  const path = encodeURIComponent(inst);
  const qs =
    args.numberDigits && String(args.numberDigits).replace(/\D/g, "").length >= 10
      ? `?number=${encodeURIComponent(String(args.numberDigits).replace(/\D/g, ""))}`
      : "";
  const url = `${base}/instance/connect/${path}${qs}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { apikey: args.apiKey, accept: "application/json" },
    cache: "no-store",
  });
  const text = await r.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  let fetchInst: any = null;
  try {
    const fu = `${base}/instance/fetchInstances?instanceName=${encodeURIComponent(inst)}`;
    const fr = await fetch(fu, {
      method: "GET",
      headers: { apikey: args.apiKey, accept: "application/json" },
      cache: "no-store",
    });
    const ft = await fr.text();
    try {
      fetchInst = JSON.parse(ft);
    } catch {
      fetchInst = { raw: ft };
    }
  } catch {
    fetchInst = null;
  }

  const merged = mergeEvolutionQr(body, fetchInst);
  const b64 =
    merged?.base64 ||
    merged?.qrcode?.base64 ||
    (typeof merged?.code === "string" && merged.code.startsWith("data:image") ? merged.code : null);
  if (b64) {
    evolutionQrStoreFromRest(inst, b64);
  }
  return { httpStatus: r.status, evolution: merged, fetchInstancesBody: fetchInst };
}

/** Extrai estado legível da resposta fetchInstances (formatos variam entre versões). */
export function summarizeEvolutionInstance(fetchInstancesBody: any): {
  state: string | null;
  instanceName: string | null;
  raw: any;
} {
  const raw = fetchInstancesBody;
  let row: any = null;
  if (Array.isArray(raw) && raw.length) row = raw[0];
  else if (raw?.instance) row = raw.instance;
  else if (raw && typeof raw === "object" && !Array.isArray(raw)) row = raw;

  const state =
    row?.connectionStatus ??
    row?.state ??
    row?.status ??
    row?.instance?.status ??
    row?.instance?.state ??
    row?.instance?.connectionStatus ??
    null;
  const instanceName =
    row?.instanceName ?? row?.instance?.instanceName ?? row?.name ?? null;
  return {
    state: state != null ? String(state) : null,
    instanceName: instanceName != null ? String(instanceName) : null,
    raw: row,
  };
}
