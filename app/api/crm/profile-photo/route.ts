import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Permite exibir fotos do WhatsApp / Meta no CRM sem bloqueio de hotlink no navegador. */
function allowedTargetUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:") return null;
    const h = parsed.hostname.toLowerCase();
    if (h === "pps.whatsapp.net" || h.endsWith(".whatsapp.net")) return parsed;
    if (h.endsWith(".fbcdn.net") || h.endsWith(".fbsbx.com")) return parsed;
    if (h === "facebook.com" || h.endsWith(".facebook.com")) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("u");
    if (!raw) {
      return NextResponse.json({ error: "Parâmetro u obrigatório" }, { status: 400 });
    }
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const target = allowedTargetUrl(decoded);
    if (!target) {
      return NextResponse.json({ error: "URL não permitida" }, { status: 400 });
    }

    const r = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PendenciasCRM/1.0)",
        Accept: "image/*,*/*",
      },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ error: "Não foi possível carregar a imagem" }, { status: 502 });
    }
    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "image/jpeg";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("profile-photo proxy:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
