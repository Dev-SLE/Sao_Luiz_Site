import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { getGoogleOAuthClient } from "../../../lib/server/googleDrive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const username = searchParams.get("state");
    if (!code || !username) return NextResponse.json({ error: "code/state obrigatórios" }, { status: 400 });

    const oAuth2Client = getGoogleOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    const pool = getPool();
    await pool.query(
      `
        INSERT INTO pendencias.user_tokens (username, access_token, refresh_token, expiry_date)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expiry_date = EXCLUDED.expiry_date
      `,
      [username, tokens.access_token, tokens.refresh_token, tokens.expiry_date]
    );

    return new NextResponse("Autenticação Google concluída! Pode fechar esta janela.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("Erro ao autenticar Google:", err);
    return NextResponse.json({ error: "Erro ao autenticar Google" }, { status: 500 });
  }
}

