import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { getSessionContext } from "@/lib/server/authorization";
import { canSessionAccessFile } from "@/lib/server/fileAccess";
import { listFilesForEntity } from "@/modules/storage/fileService";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ module: string; entity: string; entityId: string }> }) {
  try {
    const session = await getSessionContext(req);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { module, entity, entityId } = await params;
    if (!module || !entity || !entityId) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }
    await ensureStorageCatalogTables();
    const pool = getPool();
    const items = await listFilesForEntity(pool, decodeURIComponent(module), decodeURIComponent(entity), decodeURIComponent(entityId));
    const filtered: typeof items = [];
    for (const f of items) {
      if (await canSessionAccessFile(pool, session, f)) filtered.push(f);
    }
    return NextResponse.json({
      items: filtered.map((f) => ({
        ...f,
        viewUrl: `/api/files/${f.id}/view`,
        downloadUrl: `/api/files/${f.id}/download`,
        thumbnailUrl: `/api/files/${f.id}/thumbnail`,
      })),
    });
  } catch (e) {
    console.error("[files.entity]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
