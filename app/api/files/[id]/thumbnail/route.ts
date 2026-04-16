import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { getSessionContext } from "@/lib/server/authorization";
import { canSessionAccessFile } from "@/lib/server/fileAccess";
import { getFileById, recordFileAccess } from "@/modules/storage/fileService";
import { getThumbnailRequestUrl } from "@/lib/server/sharepointGraph";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sizeRaw = String(searchParams.get("size") || "medium").toLowerCase();
    const size = sizeRaw === "small" || sizeRaw === "large" ? sizeRaw : "medium";

    const session = await getSessionContext(req);
    const pool = getPool();
    const file = await getFileById(pool, id);
    if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    if (!(await canSessionAccessFile(pool, session, file))) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    if (file.sharepoint_item_id && file.sharepoint_site_id && file.sharepoint_drive_id) {
      const thumbUrl = await getThumbnailRequestUrl(
        file.sharepoint_site_id,
        file.sharepoint_drive_id,
        file.sharepoint_item_id,
        size as "small" | "medium" | "large"
      );
      if (thumbUrl) {
        await recordFileAccess(pool, file.id, "thumbnail", session?.username || null);
        return NextResponse.redirect(thumbUrl, 302);
      }
      return NextResponse.redirect(new URL(`/api/files/${id}/view`, req.url), 302);
    }

    return NextResponse.json({ error: "Thumbnail indisponível" }, { status: 404 });
  } catch (e) {
    console.error("[files.thumbnail]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
