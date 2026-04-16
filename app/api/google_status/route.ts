import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Mantido para compatibilidade com clientes antigos; sempre desconectado do Google. */
export async function GET() {
  return NextResponse.json({
    connected: false,
    disabled: true,
    storage: "sharepoint_only",
    expiry_date: null,
  });
}
