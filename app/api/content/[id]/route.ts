import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { getSessionContext } from "@/lib/server/authorization";
import { canManagePortalContent } from "@/lib/server/portalContentPermissions";
import { mapContentRow } from "@/lib/server/mapContentRow";

export const runtime = "nodejs";

function uuidOrNull(v: unknown) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionContext(req);
    if (!session || !canManagePortalContent(session)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await ensureStorageCatalogTables();
    const pool = getPool();

    const fields: string[] = ["updated_at = NOW()"];
    const vals: unknown[] = [];
    const push = (col: string, val: unknown) => {
      vals.push(val);
      fields.push(`${col} = $${vals.length}`);
    };

    if ("title" in body) push("title", String(body.title || "").trim());
    if ("subtitle" in body) push("subtitle", body.subtitle || null);
    if ("description" in body) push("description", body.description || null);
    if ("cover_file_id" in body) push("cover_file_id", uuidOrNull(body.cover_file_id));
    if ("main_file_id" in body) push("main_file_id", uuidOrNull(body.main_file_id));
    if ("category" in body) push("category", body.category || null);
    if ("target_audience" in body) push("target_audience", body.target_audience || null);
    if ("publish_start" in body) push("publish_start", body.publish_start || null);
    if ("publish_end" in body) push("publish_end", body.publish_end || null);
    if ("is_featured" in body) push("is_featured", !!body.is_featured);
    if ("display_order" in body) push("display_order", Number(body.display_order) || 0);
    if ("slug" in body) push("slug", body.slug || null);
    if ("status" in body) push("status", String(body.status || "draft").trim());
    if ("metadata_json" in body) {
      const cur = await pool.query(`SELECT metadata_json FROM pendencias.content_items WHERE id = $1::uuid`, [id]);
      const existing = (cur.rows[0]?.metadata_json as Record<string, unknown>) || {};
      const incoming =
        body.metadata_json && typeof body.metadata_json === "object" && !Array.isArray(body.metadata_json)
          ? (body.metadata_json as Record<string, unknown>)
          : {};
      push("metadata_json", JSON.stringify({ ...existing, ...incoming }));
    }

    vals.push(id);
    const r = await pool.query(
      `UPDATE pendencias.content_items SET ${fields.join(", ")} WHERE id = $${vals.length}::uuid RETURNING id`,
      vals
    );
    if (!r.rows?.[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    const full = await pool.query(
      `
      SELECT ci.*,
        cf.mime_type AS cover_mime,
        mf.mime_type AS main_mime
      FROM pendencias.content_items ci
      LEFT JOIN pendencias.files cf ON cf.id = ci.cover_file_id AND cf.is_active = true
      LEFT JOIN pendencias.files mf ON mf.id = ci.main_file_id AND mf.is_active = true
      WHERE ci.id = $1::uuid
      LIMIT 1
    `,
      [id]
    );
    return NextResponse.json({ item: mapContentRow(full.rows[0] || {}) });
  } catch (e: any) {
    console.error("[content.patch]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionContext(req);
    if (!session || !canManagePortalContent(session)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await params;
    await ensureStorageCatalogTables();
    const pool = getPool();
    const r = await pool.query(`DELETE FROM pendencias.content_items WHERE id = $1::uuid RETURNING id`, [id]);
    if (!r.rows?.[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[content.delete]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
