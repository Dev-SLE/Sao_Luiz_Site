import { NextResponse } from "next/server";
import { Readable } from "stream";
import { google } from "googleapis";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables, ensureUserTokensTable } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { buildDossiePdf } from "../../../../lib/server/dossiePdf";
import { ensureDriveCaseFolder, getGoogleOAuthClient } from "../../../../lib/server/googleDrive";

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

    let pdfDriveFileId: string | null = null;
    if (body?.syncPdfToDrive) {
      await ensureUserTokensTable();
      const tokenResult = await pool.query("SELECT * FROM pendencias.user_tokens WHERE LOWER(username) = LOWER($1)", [
        session.username,
      ]);
      const userToken = tokenResult.rows?.[0];
      if (userToken?.access_token) {
        const oAuth2Client = getGoogleOAuthClient();
        oAuth2Client.setCredentials({
          access_token: userToken.access_token,
          refresh_token: userToken.refresh_token,
          expiry_date: userToken.expiry_date,
        });
        const drive = google.drive({ version: "v3", auth: oAuth2Client });
        const folderId = await ensureDriveCaseFolder(drive, cte, serie);
        const pdfBytes = await buildDossiePdf(pool, cte, serie);
        const buffer = Buffer.from(pdfBytes);
        const fname = `Dossie_CTE_${cte}_SER_${serie}.pdf`;
        const up = await drive.files.create({
          requestBody: { name: fname, parents: [folderId] },
          media: { mimeType: "application/pdf", body: Readable.from(buffer) },
          fields: "id",
        } as any);
        pdfDriveFileId = up.data.id || null;
        if (pdfDriveFileId) {
          await pool.query(`UPDATE pendencias.dossiers SET pdf_drive_file_id = $2 WHERE id = $1::uuid`, [
            dossierId,
            pdfDriveFileId,
          ]);
          const url = `https://drive.google.com/file/d/${pdfDriveFileId}/view`;
          await pool.query(
            `INSERT INTO pendencias.dossier_attachments (dossier_id, category, label, url, drive_file_id, uploaded_by, created_at)
             VALUES ($1::uuid, 'GERAL', $2, $3, $4, $5, NOW())`,
            [dossierId, fname, url, pdfDriveFileId, session.username]
          );
        }
      }
    }

    const d = await pool.query(`SELECT * FROM pendencias.dossiers WHERE id = $1::uuid`, [dossierId]);
    return NextResponse.json({ dossier: d.rows?.[0] || null, pdfDriveFileId });
  } catch (e) {
    console.error("[dossie.finalize]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
