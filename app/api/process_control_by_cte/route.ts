import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateTime } from "../../../lib/server/datetime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "").trim();
    if (!cte) return NextResponse.json({ error: "cte é obrigatório" }, { status: 400 });
    if (!serie) return NextResponse.json({ error: "serie é obrigatório" }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
      `
        SELECT *
        FROM pendencias.process_control
        WHERE cte = $1
          AND (
            serie = $2
            OR ltrim(serie, '0') = ltrim($2, '0')
          )
        ORDER BY data DESC
      `,
      [cte, serie]
    );
    const rows = result.rows.map((row: any) => ({
      ...row,
      data: formatDateTime(row.data),
    }));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Erro ao buscar histórico do processo:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

