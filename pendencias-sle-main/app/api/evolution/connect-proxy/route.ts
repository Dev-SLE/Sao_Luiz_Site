import { NextResponse } from "next/server";
import { evolutionQrStoreFromRest } from "../../../../lib/server/evolutionLastQr";

export const runtime = "nodejs";

function mergeEvolutionQr(connectBody: any, fetchBody: any): any {
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
 * Proxy server-side para GET /instance/connect/{instance} da Evolution API.
 * Útil quando o Manager (8080/manager) não mostra o QR no Edge (falta WebSocket).
 * Só ativo em development ou se EVOLUTION_CONNECT_PROXY_ENABLED=true.
 */
export async function GET(req: Request) {
  const devOk = process.env.NODE_ENV !== "production";
  const forced = process.env.EVOLUTION_CONNECT_PROXY_ENABLED === "true";
  if (!devOk && !forced) {
    return NextResponse.json({ error: "Proxy desativado em produção" }, { status: 403 });
  }

  const base = (process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const { searchParams } = new URL(req.url);
  const instance = searchParams.get("instance");
  const number = searchParams.get("number");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Defina EVOLUTION_API_KEY no .env (mesmo valor que AUTHENTICATION_API_KEY do deploy/.env)" },
      { status: 500 }
    );
  }
  if (!instance || !String(instance).trim()) {
    return NextResponse.json({ error: "Parâmetro instance obrigatório" }, { status: 400 });
  }

  const path = encodeURIComponent(String(instance).trim());
  const qs = number && String(number).replace(/\D/g, "").length >= 10
    ? `?number=${encodeURIComponent(String(number).replace(/\D/g, ""))}`
    : "";
  const url = `${base}/instance/connect/${path}${qs}`;
  const inst = String(instance).trim();

  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { apikey: apiKey, accept: "application/json" },
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
        headers: { apikey: apiKey, accept: "application/json" },
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

    if (process.env.NODE_ENV === "development") {
      console.log("[connect-proxy]", {
        instance: inst,
        connectKeys: body && typeof body === "object" ? Object.keys(body) : typeof body,
        mergedQr: Boolean(b64),
      });
    }

    return NextResponse.json(
      {
        status: r.status,
        evolution: merged,
        ...(process.env.NODE_ENV === "development"
          ? { _debug: { fetchInstancesSample: fetchInst } }
          : {}),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Falha ao chamar Evolution", hint: `URL tentada: ${base}/instance/connect/...` },
      { status: 502 }
    );
  }
}
