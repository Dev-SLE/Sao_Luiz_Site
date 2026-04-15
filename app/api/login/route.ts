import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import bcrypt from "../../../bcrypt.js";
import { serverLog } from "../../../lib/server/appLog";
import {
  authSessionSecretMissingInProduction,
  encodeSession,
  SESSION_COOKIE_NAME,
} from "../../../lib/server/session";
import { recordAuditEvent } from "../../../lib/server/ensureFase1Infrastructure";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 400 });
    }

    if (authSessionSecretMissingInProduction()) {
      await serverLog({
        level: "ERROR",
        event: "API_LOGIN_MISCONFIG",
        username: String(username),
        data: { reason: "AUTH_SESSION_SECRET ausente em produção" },
      });
      return NextResponse.json(
        {
          success: false,
          message: "Servidor mal configurado: defina AUTH_SESSION_SECRET no ambiente de produção.",
        },
        { status: 503 }
      );
    }

    const pool = getPool();
    const result = await pool.query(
      `
        SELECT u.*, p.permissions AS profile_permissions
        FROM pendencias.users u
        LEFT JOIN pendencias.profiles p ON LOWER(p.name) = LOWER(u.role)
        WHERE u.username = $1
      `,
      [username]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 401 });
    }

    const user = result.rows[0];
    const hash = user.password_hash;
    let valid = false;
    if (typeof hash === "string" && hash.startsWith("$2")) {
      valid = await bcrypt.compare(password, hash);
    } else {
      valid = password === hash;
    }

    if (!valid) {
      await serverLog({
        level: "WARN",
        event: "API_LOGIN_INVALID",
        username: String(username),
      });
      return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 401 });
    }

    await pool.query(`ALTER TABLE pendencias.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`);
    await pool.query(
      `UPDATE pendencias.users SET last_login_at = NOW(), updated_at = NOW() WHERE username = $1`,
      [String(user.username)]
    );

    await serverLog({
      level: "INFO",
      event: "API_LOGIN_SUCCESS",
      username: String(username),
      data: { role: user.role, ip, userAgent },
    });
    try {
      await recordAuditEvent({
        actorUsername: String(username),
        action: "USER_LOGIN",
        resourceType: "user",
        resourceId: String(username),
        payload: { role: String(user.role || "") },
        ip,
      });
    } catch {
      /* auditoria opcional até DB disponível */
    }
    let permissions: string[] = [];
    const rawPerms = user.profile_permissions;
    if (Array.isArray(rawPerms)) {
      permissions = rawPerms.map((x: unknown) => String(x));
    } else if (typeof rawPerms === "string") {
      try {
        const parsed = JSON.parse(rawPerms);
        if (Array.isArray(parsed)) permissions = parsed.map((x: unknown) => String(x));
      } catch {
        permissions = rawPerms.split(",").map((x: string) => x.trim()).filter(Boolean);
      }
    }

    const response = NextResponse.json({
      success: true,
      permissions,
      user: {
        username: user.username,
        role: user.role,
        origin: user.linked_origin_unit,
        dest: user.linked_dest_unit,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, encodeSession({
      username: user.username,
      role: user.role,
      origin: user.linked_origin_unit,
      dest: user.linked_dest_unit,
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12, // 12h
    });
    return response;
  } catch (error) {
    console.error("Erro no login:", error);
    await serverLog({
      level: "ERROR",
      event: "API_LOGIN_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

