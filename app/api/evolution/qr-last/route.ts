import { NextResponse } from "next/server";
import { evolutionQrGetLast } from "../../../../lib/server/evolutionLastQr";

export const runtime = "nodejs";

/**
 * Último QR capturado do webhook QRCODE_UPDATED (memória do processo).
 * Mesmas restrições que connect-proxy: só dev ou EVOLUTION_CONNECT_PROXY_ENABLED=true.
 */
export async function GET(req: Request) {
  const devOk = process.env.NODE_ENV !== "production";
  const forced = process.env.EVOLUTION_CONNECT_PROXY_ENABLED === "true";
  if (!devOk && !forced) {
    return NextResponse.json({ error: "Desativado em produção" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const instance = searchParams.get("instance");
  if (!instance || !String(instance).trim()) {
    return NextResponse.json({ error: "Parâmetro instance obrigatório" }, { status: 400 });
  }

  const qr = evolutionQrGetLast(instance);
  if (!qr) {
    return NextResponse.json({ ok: true, hasQr: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true, hasQr: true, base64: qr.base64, ageMs: qr.ageMs }, { status: 200 });
}
