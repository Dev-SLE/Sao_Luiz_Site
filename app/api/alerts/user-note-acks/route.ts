import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = String(searchParams.get("username") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "2000", 10) || 2000, 10000);

    if (!username) {
      return NextResponse.json({ error: "username obrigatório" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
      `
        SELECT DISTINCT cte, serie
        FROM pendencias.notes
        WHERE lower(usuario) = lower($1)
        ORDER BY cte DESC
        LIMIT $2
      `,
      [username, limit]
    );

    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error("Erro ao buscar confirmações de alerta por usuário:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

