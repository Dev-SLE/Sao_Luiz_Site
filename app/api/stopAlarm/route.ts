import { NextResponse } from "next/server";
import { getSessionContext } from "../../../lib/server/authorization";
import { getPool } from "../../../lib/server/db";
import { refreshCteViewIndexOne } from "../../../lib/server/cteIndex";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "").trim();
    const user = String(session.username || "").trim() || "Sistema";
    const description = String(body?.description || "RESOLVIDO").trim();
    const link = String(body?.link || "").trim();
    if (!cte || !serie) return NextResponse.json({ error: "cte/serie obrigatórios" }, { status: 400 });

    const pool = getPool();
    await pool.query(
      `
        INSERT INTO pendencias.process_control (cte, serie, data, user_name, description, link, status)
        VALUES ($1, $2, NOW(), $3, $4, $5, 'RESOLVIDO')
      `,
      [cte, serie, user, description, link || null]
    );
    await refreshCteViewIndexOne(cte, serie);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao parar alarme:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

