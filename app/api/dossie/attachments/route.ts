import { NextResponse } from "next/server";
import { Readable } from "stream";
import { google } from "googleapis";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables, ensureUserTokensTable } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { ensureDriveCaseFolder, getGoogleOAuthClient } from "../../../../lib/server/googleDrive";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view") || !can(session, "tab.operacional.dossie.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file");
    const cte = String(form.get("cte") || "").trim();
    const serie = String(form.get("serie") || "0").trim() || "0";
    const category = String(form.get("category") || "GERAL").trim().toUpperCase();
    const label = String(form.get("label") || "").trim() || null;

    if (!file || typeof file === "string") return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });

    if (category === "PAGAMENTO" && !can(session, "dossie.financeiro.attach")) {
      return NextResponse.json({ error: "Sem permissão para anexos de pagamento" }, { status: 403 });
    }

    await ensureOccurrencesSchemaTables();
    await ensureUserTokensTable();
    const pool = getPool();

    const dossRes = await pool.query(
      `SELECT id FROM pendencias.dossiers WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0')) LIMIT 1`,
      [cte, serie]
    );
    let dossierId = dossRes.rows?.[0]?.id;
    if (!dossierId) {
      const ins = await pool.query(
        `
          INSERT INTO pendencias.dossiers (cte, serie, title, status, generated_by, generated_at, created_at, updated_at)
          VALUES ($1,$2,$3,'ATIVO',$4,NOW(),NOW(),NOW())
          ON CONFLICT (cte, serie) DO UPDATE SET updated_at = NOW()
          RETURNING id
        `,
        [cte, serie, `Dossiê CTE ${cte}/${serie}`, session.username]
      );
      dossierId = ins.rows?.[0]?.id;
    }

    const tokenResult = await pool.query("SELECT * FROM pendencias.user_tokens WHERE LOWER(username) = LOWER($1)", [
      session.username,
    ]);
    const userToken = tokenResult.rows?.[0];
    if (!userToken?.access_token) {
      return NextResponse.json({ error: "Conecte o Google Drive para enviar anexos ao processo." }, { status: 401 });
    }

    const oAuth2Client = getGoogleOAuthClient();
    oAuth2Client.setCredentials({
      access_token: userToken.access_token,
      refresh_token: userToken.refresh_token,
      expiry_date: userToken.expiry_date,
    });
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const folderId = await ensureDriveCaseFolder(drive, cte, serie);

    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    const up = await drive.files.create({
      requestBody: { name: f.name, parents: [folderId] },
      media: { mimeType: f.type || "application/octet-stream", body: Readable.from(buffer) },
      fields: "id",
    } as any);
    const fileId = up.data.id;
    if (!fileId) return NextResponse.json({ error: "Falha no upload Drive" }, { status: 500 });

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const url = `https://drive.google.com/file/d/${fileId}/view`;
    const att = await pool.query(
      `INSERT INTO pendencias.dossier_attachments (dossier_id, category, label, url, drive_file_id, uploaded_by, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [dossierId, category, label, url, fileId, session.username]
    );

    await pool.query(
      `INSERT INTO pendencias.dossier_events (dossier_id, event_type, actor, description, metadata)
       VALUES ($1::uuid, 'ANEXO', $2, $3, $4::jsonb)`,
      [
        dossierId,
        session.username,
        `Anexo: ${f.name} (${category})`,
        JSON.stringify({ driveFileId: fileId, category }),
      ]
    );

    return NextResponse.json({ item: att.rows?.[0] || null, url });
  } catch (e) {
    console.error("[dossie.attachments]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
