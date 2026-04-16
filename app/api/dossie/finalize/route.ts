import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables, ensureStorageCatalogTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { buildDossiePdf } from "../../../../lib/server/dossiePdf";
import { isSharePointGraphConfigured } from "../../../../lib/server/sharepointConfig";
import { uploadFileToSharePoint } from "../../../../modules/storage/fileService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view") || !can(session, "tab.operacional.dossie.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    const body = await req.json().catch(() => ({}));
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "0").trim() || "0";
    const finalizationStatus = String(body?.finalizationStatus || "").trim();
    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });
    if (!finalizationStatus) return NextResponse.json({ error: "finalizationStatus obrigatório" }, { status: 400 });

    const pool = getPool();
    const dossRes = await pool.query(
      `SELECT id FROM pendencias.dossiers WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0')) LIMIT 1`,
      [cte, serie]
    );
    const dossierId = dossRes.rows?.[0]?.id;
    if (!dossierId) return NextResponse.json({ error: "Dossiê não encontrado. Gere o dossiê antes de finalizar." }, { status: 400 });

    const syncPdf = !!(body?.syncPdf ?? body?.syncPdfToDrive);
    if (syncPdf && !isSharePointGraphConfigured()) {
      return NextResponse.json(
        { error: "PDF não pode ser sincronizado: configure SharePoint (GRAPH_* e SHAREPOINT_*)." },
        { status: 503 }
      );
    }

    await pool.query(
      `UPDATE pendencias.dossiers SET
        finalization_status = $2,
        finalized_at = NOW(),
        finalized_by = $3,
        updated_at = NOW()
      WHERE id = $1::uuid`,
      [dossierId, finalizationStatus, session.username]
    );

    await pool.query(
      `INSERT INTO pendencias.dossier_events (dossier_id, event_type, actor, description, metadata)
       VALUES ($1::uuid, 'FINALIZACAO', $2, $3, $4::jsonb)`,
      [
        dossierId,
        session.username,
        `Dossiê finalizado com status: ${finalizationStatus}`,
        JSON.stringify({ finalizationStatus }),
      ]
    );

    let pdfFileId: string | null = null;
    if (syncPdf) {
      const pdfBytes = await buildDossiePdf(pool, cte, serie);
      const buffer = Buffer.from(pdfBytes);
      const fname = `Dossie_CTE_${cte}_SER_${serie}.pdf`;
      await ensureStorageCatalogTables();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const fileRow = await uploadFileToSharePoint({
        pool,
        module: "operacional",
        entity: "dossier",
        entityId: String(dossierId),
        originalName: fname,
        mimeType: "application/pdf",
        buffer,
        uploadedBy: session.username,
        pathContext: {
          year: String(now.getFullYear()),
          month: pad(now.getMonth() + 1),
          entity_id: String(dossierId),
          dossier_id: String(dossierId),
          cte,
          serie,
        },
      });
      pdfFileId = fileRow.id;
      const viewUrl = `/api/files/${fileRow.id}/view`;
      await pool.query(`UPDATE pendencias.dossiers SET pdf_file_id = $2 WHERE id = $1::uuid`, [dossierId, pdfFileId]);
      await pool.query(
        `INSERT INTO pendencias.dossier_attachments (dossier_id, category, label, url, file_id, uploaded_by, created_at)
         VALUES ($1::uuid, 'GERAL', $2, $3, $4::uuid, $5, NOW())`,
        [dossierId, fname, viewUrl, pdfFileId, session.username]
      );
    }

    const d = await pool.query(`SELECT * FROM pendencias.dossiers WHERE id = $1::uuid`, [dossierId]);
    return NextResponse.json({ dossier: d.rows?.[0] || null, pdfFileId });
  } catch (e) {
    console.error("[dossie.finalize]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
