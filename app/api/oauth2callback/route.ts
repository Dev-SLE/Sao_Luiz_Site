import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { error: "OAuth Google desativado. O storage é apenas SharePoint." },
    { status: 410 }
  );
}
