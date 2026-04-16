import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { getSessionContext } from "@/lib/server/authorization";
import { canSessionAccessFile } from "@/lib/server/fileAccess";
import { getFileById, recordFileAccess } from "@/modules/storage/fileService";
import { getItemContentResponse } from "@/lib/server/sharepointGraph";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSessionContext(req);
    const pool = getPool();
    const file = await getFileById(pool, id);
    if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    if (!(await canSessionAccessFile(pool, session, file))) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    if (file.sharepoint_item_id && file.sharepoint_site_id && file.sharepoint_drive_id) {
      const res = await getItemContentResponse(file.sharepoint_site_id, file.sharepoint_drive_id, file.sharepoint_item_id);
      if (!res.ok) {
        return NextResponse.json({ error: "Falha ao obter conteúdo no storage" }, { status: 502 });
      }
      const ct = file.mime_type || res.headers.get("content-type") || "application/octet-stream";
      await recordFileAccess(pool, file.id, "view", session?.username || null);
      return new NextResponse(res.body, {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Cache-Control": "private, max-age=120",
          "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name || file.file_name)}"`,
        },
      });
    }

    return NextResponse.json({ error: "Arquivo sem conteúdo SharePoint associado" }, { status: 410 });
  } catch (e) {
    console.error("[files.view]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
