import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureUserTokensTable } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = String(searchParams.get("username") || "").trim();
    if (!username) return NextResponse.json({ error: "username obrigatório" }, { status: 400 });

    const pool = getPool();
    await ensureUserTokensTable();
    const result = await pool.query(
      `SELECT access_token, expiry_date FROM pendencias.user_tokens WHERE username = $1`,
      [username]
    );
    const row = result.rows?.[0];
    const connected = !!row?.access_token;
    return NextResponse.json({ connected, expiry_date: row?.expiry_date ?? null });
  } catch (error) {
    console.error("Erro ao verificar Google status:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

