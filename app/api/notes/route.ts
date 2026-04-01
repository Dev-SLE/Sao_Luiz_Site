import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { formatDateTime } from "../../../lib/server/datetime";
import { refreshCteViewIndexOne } from "../../../lib/server/cteIndex";
import { ensureOccurrencesSchemaTables } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cte, serie, codigo, usuario, texto, link_imagem, status_busca, data, agency_id, indemnification_id } =
      body || {};

    if (!cte || !usuario) {
      return NextResponse.json({ error: "cte/usuario obrigatórios" }, { status: 400 });
    }

    const pool = getPool();
    await ensureOccurrencesSchemaTables();
    const agencyId = agency_id ? String(agency_id).trim() : null;
    const indemnificationId = indemnification_id ? String(indemnification_id).trim() : null;

    const query = `
      INSERT INTO pendencias.notes (cte, serie, codigo, data, usuario, texto, link_imagem, status_busca, agency_id, indemnification_id)
      VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8::uuid, $9::uuid)
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
      agencyId,
      indemnificationId,
    ]);

    const row = result.rows?.[0];
    if (row?.id && indemnificationId && agencyId) {
      await pool.query(
        `UPDATE pendencias.indemnification_agency_followups
         SET response_note_id = $1, responded_at = NOW()
         WHERE indemnification_id = $2::uuid AND agency_id = $3::uuid`,
        [row.id, indemnificationId, agencyId]
      );
    }
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

