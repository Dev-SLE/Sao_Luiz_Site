import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables, ensureStorageCatalogTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { isSharePointGraphConfigured } from "../../../../lib/server/sharepointConfig";
import { uploadFileToSharePoint } from "../../../../modules/storage/fileService";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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

    if (!isSharePointGraphConfigured()) {
      return NextResponse.json(
        { error: "SharePoint não configurado. Defina GRAPH_* e SHAREPOINT_* no ambiente." },
        { status: 503 }
      );
    }

    await ensureOccurrencesSchemaTables();
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

    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());

    await ensureStorageCatalogTables();
    const now = new Date();
    const fileRow = await uploadFileToSharePoint({
      pool,
      module: "operacional",
      entity: "dossier",
      entityId: String(dossierId),
      originalName: f.name,
      mimeType: f.type || "application/octet-stream",
      buffer,
      uploadedBy: session.username,
      pathContext: {
        year: String(now.getFullYear()),
        month: pad2(now.getMonth() + 1),
        entity_id: String(dossierId),
        dossier_id: String(dossierId),
        cte,
        serie,
      },
    });
    const viewUrl = `/api/files/${fileRow.id}/view`;
    const att = await pool.query(
      `INSERT INTO pendencias.dossier_attachments (dossier_id, category, label, url, file_id, uploaded_by, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, NOW())
       RETURNING *`,
      [dossierId, category, label, viewUrl, fileRow.id, session.username]
    );
    await pool.query(
      `INSERT INTO pendencias.dossier_events (dossier_id, event_type, actor, description, metadata)
       VALUES ($1::uuid, 'ANEXO', $2, $3, $4::jsonb)`,
      [dossierId, session.username, `Anexo: ${f.name} (${category})`, JSON.stringify({ fileId: fileRow.id, category })],
    );
    return NextResponse.json({ item: att.rows?.[0] || null, url: viewUrl });
  } catch (e) {
    console.error("[dossie.attachments]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
