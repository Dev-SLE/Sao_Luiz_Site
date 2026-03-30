import { NextResponse } from "next/server";
import { runEvolutionConnect } from "../../../../lib/server/evolutionConnectHelpers";
import { normalizeEvolutionServerUrl } from "../../../../lib/server/evolutionUrl";

export const runtime = "nodejs";

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

  const base = normalizeEvolutionServerUrl(
    process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080"
  ).replace(/\/+$/, "");
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

  const inst = String(instance).trim();
  const numDigits = number && String(number).replace(/\D/g, "").length >= 10 ? String(number).replace(/\D/g, "") : null;

  try {
    const { httpStatus, evolution, fetchInstancesBody } = await runEvolutionConnect({
      baseUrl: base,
      apiKey,
      instance: inst,
      numberDigits: numDigits,
    });

    const b64 =
      evolution?.base64 ||
      evolution?.qrcode?.base64 ||
      (typeof evolution?.code === "string" && evolution.code.startsWith("data:image") ? evolution.code : null);

    if (process.env.NODE_ENV === "development") {
      console.log("[connect-proxy]", {
        instance: inst,
        mergedQr: Boolean(b64),
      });
    }

    return NextResponse.json(
      {
        status: httpStatus,
        evolution,
        ...(process.env.NODE_ENV === "development"
          ? { _debug: { fetchInstancesSample: fetchInstancesBody } }
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
