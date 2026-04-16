import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Google Drive foi desativado; o storage é apenas SharePoint via Microsoft Graph. */
export async function GET() {
  return NextResponse.json(
    { error: "Integração Google Drive desativada. O sistema usa apenas SharePoint." },
    { status: 410 }
  );
}
