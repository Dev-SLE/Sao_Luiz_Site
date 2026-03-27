import { NextResponse } from "next/server";
import { getSitePublicBaseUrl } from "../../../../lib/sitePublicUrl";

export const runtime = "nodejs";

/**
 * Chama POST /webhook/set/{instance} na Evolution com QRCODE_UPDATED + Base64.
 * O Manager às vezes não persiste os eventos; isso força pelo REST oficial.
 * Mesmas regras que connect-proxy (dev ou EVOLUTION_CONNECT_PROXY_ENABLED).
 */
export async function GET(req: Request) {
  const devOk = process.env.NODE_ENV !== "production";
  const forced = process.env.EVOLUTION_CONNECT_PROXY_ENABLED === "true";
  if (!devOk && !forced) {
    return NextResponse.json({ error: "Desativado em produção" }, { status: 403 });
  }

  const base = (process.env.EVOLUTION_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const token = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  const { searchParams } = new URL(req.url);
  const instance = searchParams.get("instance");
  const publicBase =
    searchParams.get("publicBase")?.trim() || getSitePublicBaseUrl() || "http://host.docker.internal:3000";

  if (!apiKey) {
    return NextResponse.json({ error: "Defina EVOLUTION_API_KEY no .env" }, { status: 500 });
  }
  if (!instance?.trim()) {
    return NextResponse.json({ error: "Parâmetro instance obrigatório" }, { status: 400 });
  }

  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const webhookUrl = `${publicBase.replace(/\/+$/, "")}/api/whatsapp/evolution/webhook${qs}`;

  const payload = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events: [
      "QRCODE_UPDATED",
      "CONNECTION_UPDATE",
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "MESSAGES_EDITED",
    ],
  };

  try {
    const url = `${base}/webhook/set/${encodeURIComponent(instance.trim())}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let evolution: unknown;
    try {
      evolution = JSON.parse(text);
    } catch {
      evolution = { raw: text };
    }
    return NextResponse.json(
      {
        ok: r.ok,
        httpStatus: r.status,
        evolutionWebhookUrl: webhookUrl,
        publicBaseUsed: publicBase,
        evolution,
        hint:
          "No Manager, use Conectar na instância de novo. No terminal do Next deve aparecer event qrcode.updated se a Evolution emitir o QR.",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
