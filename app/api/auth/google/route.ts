import { NextResponse } from "next/server";
import { getGoogleOAuthClient } from "../../../../lib/server/googleDrive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  if (!username) return NextResponse.json({ error: "Username necessário" }, { status: 400 });

  const oAuth2Client = getGoogleOAuthClient();
  const scopes = ["https://www.googleapis.com/auth/drive.file"];
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: username,
    prompt: "consent",
  });
  return NextResponse.redirect(url);
}

