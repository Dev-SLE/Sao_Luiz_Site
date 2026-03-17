import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT * FROM pendencias.users");
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

