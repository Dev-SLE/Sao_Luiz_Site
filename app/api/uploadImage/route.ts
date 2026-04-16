import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureAppLogsTable, ensureStorageCatalogTables } from "../../../lib/server/ensureSchema";
import { getSessionContext } from "../../../lib/server/authorization";
import { isSharePointGraphConfigured } from "../../../lib/server/sharepointConfig";
import { uploadFileToSharePoint } from "../../../modules/storage/fileService";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const form = await req.formData();
    const file = form.get("file");
    const username = String(session.username || "").trim();

    if (!file || typeof file === "string") return NextResponse.json({ success: false, error: "Arquivo não enviado." }, { status: 400 });
    if (!username) return NextResponse.json({ success: false, error: "Sessão inválida." }, { status: 401 });

    if (!isSharePointGraphConfigured()) {
      return NextResponse.json(
        { success: false, error: "SharePoint não configurado (GRAPH_* e SHAREPOINT_*)." },
        { status: 503 }
      );
    }

    const pool = getPool();
    const f = file as File;
    const arrayBuffer = await f.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadTarget = String(form.get("uploadTarget") || "").trim().toLowerCase();
    const caseCte = String(form.get("caseCte") || "").trim();
    const caseSerie = String(form.get("caseSerie") || "0").trim() || "0";

    await ensureStorageCatalogTables();
    const now = new Date();
    const year = String(now.getFullYear());
    const month = pad2(now.getMonth() + 1);

    if (uploadTarget === "processos" && caseCte) {
      await pool.query(
        `INSERT INTO pendencias.dossiers (cte, serie, title, status, generated_by, generated_at, created_at, updated_at)
         VALUES ($1,$2,$3,'ATIVO',$4,NOW(),NOW(),NOW())
         ON CONFLICT (cte, serie) DO UPDATE SET updated_at = NOW()`,
        [caseCte, caseSerie, `Dossiê CTE ${caseCte}/${caseSerie}`, username]
      );
      const dr = await pool.query(`SELECT id FROM pendencias.dossiers WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0')) LIMIT 1`, [
        caseCte,
        caseSerie,
      ]);
      const dossierId = dr.rows?.[0]?.id as string | undefined;
      if (!dossierId) throw new Error("Dossiê não encontrado após upsert");
      const fileRow = await uploadFileToSharePoint({
        pool,
        module: "operacional",
        entity: "dossier",
        entityId: dossierId,
        originalName: f.name,
        mimeType: f.type || "application/octet-stream",
        buffer,
        uploadedBy: username,
        pathContext: {
          year,
          month,
          entity_id: dossierId,
          dossier_id: dossierId,
          cte: caseCte,
          serie: caseSerie,
        },
      });
      const previewUrl = `/api/files/${fileRow.id}/view`;
      try {
        await ensureAppLogsTable();
        await pool.query(
          `INSERT INTO pendencias.app_logs (level, source, event, username, payload)
           VALUES ('INFO', 'operacional', 'NOTE_FILE_UPLOAD_SUCCESS', $1, $2)`,
          [username, JSON.stringify({ fileName: f.name, mimeType: f.type || "", fileId: fileRow.id, storage: "sharepoint" })]
        );
      } catch {}
      return NextResponse.json({
        success: true,
        url: previewUrl,
        downloadUrl: `/api/files/${fileRow.id}/download`,
        id: fileRow.id,
      });
    }

    const fileRow = await uploadFileToSharePoint({
      pool,
      module: "operacional",
      entity: "note",
      entityId: username,
      originalName: f.name,
      mimeType: f.type || "application/octet-stream",
      buffer,
      uploadedBy: username,
      pathContext: { year, month, entity_id: username },
    });
    const previewUrl = `/api/files/${fileRow.id}/view`;
    try {
      await ensureAppLogsTable();
      await pool.query(
        `INSERT INTO pendencias.app_logs (level, source, event, username, payload)
         VALUES ('INFO', 'operacional', 'NOTE_FILE_UPLOAD_SUCCESS', $1, $2)`,
        [username, JSON.stringify({ fileName: f.name, mimeType: f.type || "", fileId: fileRow.id, storage: "sharepoint" })]
      );
    } catch {}
    return NextResponse.json({
      success: true,
      url: previewUrl,
      downloadUrl: `/api/files/${fileRow.id}/download`,
      id: fileRow.id,
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    try {
      const pool = getPool();
      await ensureAppLogsTable();
      await pool.query(
        `INSERT INTO pendencias.app_logs (level, source, event, payload)
         VALUES ('ERROR', 'operacional', 'NOTE_FILE_UPLOAD_ERROR', $1)`,
        [JSON.stringify({ message: (error as any)?.message || String(error) })]
      );
    } catch {}
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
