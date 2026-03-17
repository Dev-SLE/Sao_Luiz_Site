import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { formatDateTime } from "../../../../lib/server/datetime";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ cte: string }> }) {
  try {
    const { cte } = await params;
    const pool = getPool();
    const result = await pool.query("SELECT * FROM pendencias.notes WHERE cte = $1 ORDER BY data DESC", [cte]);
    const rows = result.rows.map((row: any) => ({
      ...row,
      data: formatDateTime(row.data),
    }));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Erro ao buscar notas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

