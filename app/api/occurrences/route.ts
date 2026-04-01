import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../lib/server/authorization";
import { insertOcorrenciasLog } from "../../../lib/server/indemnificationWorkflow";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "").trim();
    const leadId = String(searchParams.get("leadId") || "").trim();
    const where: string[] = [];
    const params: any[] = [];
    if (cte) {
      params.push(cte);
      where.push(`cte = $${params.length}`);
    }
    if (serie) {
      params.push(serie);
      where.push(`(serie = $${params.length} OR ltrim(serie, '0') = ltrim($${params.length}, '0'))`);
    }
    if (leadId) {
      params.push(leadId);
      where.push(`lead_id = $${params.length}::uuid`);
    }
    const sql = `
      SELECT *
      FROM pendencias.occurrences
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 500
    `;
    const r = await pool.query(sql, params);
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error("[occurrences.get]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "0").trim() || "0";
    const occurrenceType = String(body?.occurrenceType || "OUTROS").toUpperCase();
    const description = String(body?.description || "").trim();
    if (!cte || !description) {
      return NextResponse.json({ error: "cte e description são obrigatórios" }, { status: 400 });
    }
    const q = await pool.query(
      `
        INSERT INTO pendencias.occurrences (
          cte, serie, occurrence_type, description, status, source, lead_id, contact_name, contact_phone, created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,'ABERTA',$5,$6,$7,$8,$9,NOW(),NOW())
        RETURNING *
      `,
      [
        cte,
        serie,
        occurrenceType,
        description,
        String(body?.source || "OPERACIONAL").toUpperCase(),
        body?.leadId ? String(body.leadId) : null,
        body?.contactName ? String(body.contactName) : null,
        body?.contactPhone ? String(body.contactPhone) : null,
        body?.createdBy ? String(body.createdBy) : null,
      ]
    );
    return NextResponse.json({ item: q.rows?.[0] || null });
  } catch (e) {
    console.error("[occurrences.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Encaminha ocorrência ABERTA para trilha de indenização ou dossiê direto (único ou exclusivo). */
export async function PATCH(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const track = String(body?.track || "").toUpperCase();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    if (track !== "INDENIZACAO" && track !== "DOSSIE_DIRETO") {
      return NextResponse.json({ error: "track deve ser INDENIZACAO ou DOSSIE_DIRETO" }, { status: 400 });
    }

    const occRes = await pool.query(`SELECT * FROM pendencias.occurrences WHERE id = $1::uuid LIMIT 1`, [id]);
    const occ = occRes.rows?.[0];
    if (!occ) return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });
    const st = String(occ.status || "").toUpperCase();
    if (st !== "ABERTA") {
      return NextResponse.json({ error: "Só é possível encaminhar ocorrências com status ABERTA" }, { status: 400 });
    }

    const actor = session.username || "sistema";

    if (track === "INDENIZACAO") {
      await pool.query(
        `UPDATE pendencias.occurrences SET status = 'EM_INDENIZACAO', resolution_track = 'INDENIZACAO', updated_at = NOW() WHERE id = $1::uuid`,
        [id]
      );
      const cnt = await pool.query(
        `SELECT COUNT(*)::int AS c FROM pendencias.indemnifications WHERE occurrence_id = $1::uuid`,
        [id]
      );
      if ((cnt.rows?.[0]?.c || 0) === 0) {
        await pool.query(
          `INSERT INTO pendencias.indemnifications (
            occurrence_id, status, currency, notes, created_by, created_at, updated_at
          ) VALUES ($1::uuid,'ATIVA','BRL',$2,$3,NOW(),NOW())`,
          [id, "Indenização aberta a partir da ocorrência formal.", actor]
        );
      }
    } else {
      await pool.query(
        `UPDATE pendencias.occurrences SET status = 'EM_DOSSIE', resolution_track = 'DOSSIE_DIRETO', updated_at = NOW() WHERE id = $1::uuid`,
        [id]
      );
      const cte = String(occ.cte || "").trim();
      const serie = String(occ.serie || "0").trim() || "0";
      const title = `Dossiê CTE ${cte}/${serie}`;
      const doss = await pool.query(
        `
          INSERT INTO pendencias.dossiers (cte, serie, title, status, generated_by, generated_at, created_at, updated_at)
          VALUES ($1,$2,$3,'ATIVO',$4,NOW(),NOW(),NOW())
          ON CONFLICT (cte, serie)
          DO UPDATE SET title = EXCLUDED.title, generated_by = EXCLUDED.generated_by, generated_at = NOW(), updated_at = NOW()
          RETURNING id
        `,
        [cte, serie, title, actor]
      );
      const dossierId = doss.rows?.[0]?.id;
      if (dossierId) {
        await pool.query(
          `INSERT INTO pendencias.dossier_events (dossier_id, event_type, actor, description, metadata)
           VALUES ($1::uuid,'ABERTURA_TRILHA_DIRETA',$2,$3,$4::jsonb)`,
          [dossierId, actor, "Dossiê vinculado à ocorrência via trilha direta (sem indenização).", { occurrence_id: id }]
        );
      }
    }

    const refreshed = await pool.query(`SELECT * FROM pendencias.occurrences WHERE id = $1::uuid`, [id]);
    const item = refreshed.rows?.[0];
    try {
      await insertOcorrenciasLog(pool, "OCCURRENCE_TRACK", actor, { occurrenceId: id, track }, String(occ.cte || ""), String(occ.serie || "0"));
    } catch {}
    return NextResponse.json({ item: item || null });
  } catch (e) {
    console.error("[occurrences.patch]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
