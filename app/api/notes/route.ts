import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateTime } from "../../../lib/server/datetime";
import { refreshCteViewIndexOne } from "../../../lib/server/cteIndex";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cte, serie, codigo, usuario, texto, link_imagem, status_busca, data } = body || {};

    if (!cte || !usuario) {
      return NextResponse.json({ error: "cte/usuario obrigatórios" }, { status: 400 });
    }

    const pool = getPool();
    const query = `
      INSERT INTO pendencias.notes (cte, serie, codigo, data, usuario, texto, link_imagem, status_busca)
      VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      String(cte),
      String(serie || ""),
      String(codigo || ""),
      String(usuario),
      String(texto || ""),
      String(link_imagem || ""),
      String(status_busca || ""),
    ]);

    const row = result.rows?.[0];
    if (row?.cte && row?.serie) {
      await refreshCteViewIndexOne(String(row.cte), String(row.serie));
    }

    const resp = row
      ? {
          ...row,
          data: formatDateTime(row.data),
        }
      : null;

    return NextResponse.json(resp);
  } catch (error) {
    console.error("Erro ao adicionar nota:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const pool = getPool();
    await pool.query("DELETE FROM pendencias.notes WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar nota:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

