import { NextRequest, NextResponse } from "next/server";

/**
 * Evolution Manager às vezes concatena base (…/api/whatsapp/evolution) com path
 * (/api/whatsapp/evolution/webhook), gerando URL duplicada.
 * Rewrite mantém método e corpo do POST.
 */
const DUPLICATE_WEBHOOK = "/api/whatsapp/evolution/api/whatsapp/evolution/webhook";

export function middleware(request: NextRequest) {
  const p = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (p !== DUPLICATE_WEBHOOK) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/api/whatsapp/evolution/webhook";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [DUPLICATE_WEBHOOK, `${DUPLICATE_WEBHOOK}/`],
};
