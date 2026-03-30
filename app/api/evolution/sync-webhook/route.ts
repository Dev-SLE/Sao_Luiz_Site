import { NextResponse } from "next/server";
import { getSitePublicBaseUrl } from "../../../../lib/sitePublicUrl";
import { normalizeEvolutionServerUrl } from "../../../../lib/server/evolutionUrl";
import { syncEvolutionInstanceWebhook } from "../../../../lib/server/evolutionWebhookSync";

export const runtime = "nodejs";

/**
 * Chama a Evolution para gravar webhook (URL pública do CRM + eventos).
 * Mesmas regras que connect-proxy (dev ou EVOLUTION_CONNECT_PROXY_ENABLED).
 */
export async function GET(req: Request) {
  const devOk = process.env.NODE_ENV !== "production";
  const forced = process.env.EVOLUTION_CONNECT_PROXY_ENABLED === "true";
  if (!devOk && !forced) {
    return NextResponse.json({ error: "Desativado em produção" }, { status: 403 });
  }

  const base = normalizeEvolutionServerUrl(
    process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080"
  ).replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const { searchParams } = new URL(req.url);
  const instance = searchParams.get("instance");
  const publicBaseParam = searchParams.get("publicBase")?.trim();
  const publicBaseOverride =
    publicBaseParam ||
    (getSitePublicBaseUrl() ? undefined : "http://host.docker.internal:3000");

  if (!apiKey) {
    return NextResponse.json({ error: "Defina EVOLUTION_API_KEY no .env" }, { status: 500 });
  }
  if (!instance?.trim()) {
    return NextResponse.json({ error: "Parâmetro instance obrigatório" }, { status: 400 });
  }

  const result = await syncEvolutionInstanceWebhook({
    serverUrl: base,
    apiKey,
    instance: instance.trim(),
    publicBaseOverride: publicBaseOverride || undefined,
  });

  return NextResponse.json(
    {
      ok: result.ok,
      httpStatus: result.httpStatus,
      evolutionWebhookUrl: result.webhookUrl,
      publicBaseUsed: publicBaseParam || getSitePublicBaseUrl() || publicBaseOverride || null,
      endpoint: result.endpoint,
      evolution: result.evolution,
      error: result.error,
      hint: result.ok
        ? "Webhook gravado via API. Recarregue o Manager se a tela ainda estiver em branco."
        : "Confira NEXT_PUBLIC_APP_URL, chave apikey e nome exato da instância.",
    },
    { status: 200 }
  );
}
