import { NextResponse } from "next/server";
import { getGoogleOAuthClient } from "../../../../lib/server/googleDrive";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireApiPermissions(req, ["module.operacional.view"]);
  if (guard.denied) return guard.denied;
  const { searchParams } = new URL(req.url);
  const usernameFromSession = guard.session?.username || "";
  const usernameArg = searchParams.get("username");
  if (usernameArg && usernameArg.toLowerCase() !== usernameFromSession.toLowerCase()) {
    return NextResponse.json({ error: "Username inválido para a sessão atual" }, { status: 403 });
  }
  const username = usernameFromSession;
  if (!username) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

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

