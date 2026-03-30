import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const appSecret = process.env.WHATSAPP_APP_SECRET || "";

  return NextResponse.json({
    ok: true,
    env: {
      verifyTokenConfigured: !!verifyToken,
      accessTokenConfigured: !!accessToken,
      phoneNumberIdConfigured: !!phoneNumberId,
      appSecretConfigured: !!appSecret,
      // não expõe valores completos
      phoneNumberIdPreview: phoneNumberId ? `${phoneNumberId.slice(0, 4)}...${phoneNumberId.slice(-4)}` : null,
      accessTokenPreview: accessToken ? `${accessToken.slice(0, 8)}...` : null,
    },
    now: new Date().toISOString(),
  });
}

