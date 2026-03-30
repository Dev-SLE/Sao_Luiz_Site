import { NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE_NAME } from "../../../../lib/server/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const rawCookie = req.headers.get("cookie") || "";
  const sessionCookie = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];
  const session = decodeSession(sessionCookie ? decodeURIComponent(sessionCookie) : null);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      role: session.role,
      origin: session.origin || "",
      dest: session.dest || "",
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
