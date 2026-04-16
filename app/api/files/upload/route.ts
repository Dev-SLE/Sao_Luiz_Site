import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { can, getSessionContext } from "@/lib/server/authorization";
import { canManagePortalContent } from "@/lib/server/portalContentPermissions";
import { isSharePointGraphConfigured, storageDefaultIsSharePoint } from "@/lib/server/sharepointConfig";
import { uploadFileToSharePoint } from "@/modules/storage/fileService";
import type { PathTemplateContext } from "@/modules/storage/types";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "workspace.app.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const module = String(form.get("module") || "").trim();
    const entity = String(form.get("entity") || "").trim();
    const entityId = String(form.get("entity_id") || "").trim();
    if (!file || typeof file === "string") return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    if (!module || !entity || !entityId) {
      return NextResponse.json({ error: "module, entity e entity_id são obrigatórios" }, { status: 400 });
    }

    if (module === "operacional" && entity === "dossier") {
      if (!can(session, "module.operacional.view") || !can(session, "tab.operacional.dossie.view")) {
        return NextResponse.json({ error: "Sem permissão para anexos do dossiê" }, { status: 403 });
      }
    }
    if (module === "portal") {
      if (!canManagePortalContent(session)) {
        return NextResponse.json({ error: "Sem permissão para enviar mídia do portal" }, { status: 403 });
      }
    }

    const useSp = isSharePointGraphConfigured() && storageDefaultIsSharePoint();
    if (!useSp) {
      return NextResponse.json(
        { error: "Upload indisponível: configure GRAPH_* e SHAREPOINT_* (Microsoft Graph + SharePoint)." },
        { status: 503 }
      );
    }

    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    const now = new Date();
    const pathContext: PathTemplateContext = {
      year: String(now.getFullYear()),
      month: pad2(now.getMonth() + 1),
      entity_id: entityId,
      dossier_id: entityId,
      cte: String(form.get("cte") || "").trim() || undefined,
      serie: String(form.get("serie") || "").trim() || undefined,
      category_slug: String(form.get("category_slug") || "").trim() || undefined,
      content_slug: String(form.get("content_slug") || "").trim() || undefined,
      subtype: String(form.get("subtype") || "").trim() || undefined,
    };

    await ensureStorageCatalogTables();
    const pool = getPool();
    const row = await uploadFileToSharePoint({
      pool,
      module,
      entity,
      entityId,
      originalName: f.name || "arquivo",
      mimeType: f.type || "application/octet-stream",
      buffer,
      uploadedBy: session.username,
      pathContext,
    });

    const viewUrl = `/api/files/${row.id}/view`;
    return NextResponse.json({ file: row, viewUrl, downloadUrl: `/api/files/${row.id}/download` });
  } catch (e: any) {
    console.error("[files.upload]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
