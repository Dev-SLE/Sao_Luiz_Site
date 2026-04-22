import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/server/session";
import { getSessionContext } from "../../../../lib/server/authorization";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getSessionContext(req);
  if (!ctx) {
    return NextResponse.json({ authenticated: false, user: null, permissions: [] }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      username: ctx.username,
      role: ctx.role,
      origin: ctx.origin || "",
      dest: ctx.dest || "",
      biVendedora: ctx.biVendedora || "",
      mustChangePassword: Boolean(ctx.mustChangePassword),
    },
    permissions: ctx.permissions,
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
