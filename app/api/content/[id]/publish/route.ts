import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { getSessionContext } from "@/lib/server/authorization";
import { canManagePortalContent } from "@/lib/server/portalContentPermissions";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionContext(req);
    if (!session || !canManagePortalContent(session)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await params;
    await ensureStorageCatalogTables();
    const pool = getPool();
    const r = await pool.query(
      `
      UPDATE pendencias.content_items
      SET status = 'published',
          publish_start = COALESCE(publish_start, NOW()),
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING *
    `,
      [id]
    );
    if (!r.rows?.[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ item: r.rows[0] });
  } catch (e) {
    console.error("[content.publish]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
