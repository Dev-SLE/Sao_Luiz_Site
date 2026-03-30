import { NextResponse } from "next/server";

/**
 * Evita 404 quando alguém cola só /api/whatsapp/evolution (falta /webhook).
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "path_incompleto",
    use: "/api/whatsapp/evolution/webhook",
    hint: "O webhook da Evolution fica em …/webhook (GET confere; eventos em POST).",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "path_incompleto",
      use: "/api/whatsapp/evolution/webhook",
      hint: "Configure a URL do webhook com o sufixo /webhook.",
    },
    { status: 404 }
  );
}
