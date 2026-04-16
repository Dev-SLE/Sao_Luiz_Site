import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { can, getSessionContext } from "@/lib/server/authorization";
import { canManagePortalContent } from "@/lib/server/portalContentPermissions";
import { mapContentRow } from "@/lib/server/mapContentRow";

export const runtime = "nodejs";

/** Lista conteúdo publicado (portal) ou rascunhos (gestor + manage=1). */
export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = String(searchParams.get("type") || "").trim();
    const manage = String(searchParams.get("manage") || "") === "1";

    if (manage) {
      if (!canManagePortalContent(session)) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }
    } else {
      if (!can(session, "portal.home.view")) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }
    }

    await ensureStorageCatalogTables();
    const pool = getPool();
    const params: unknown[] = [];
    let where = "1=1";
    if (type) {
      params.push(type);
      where += ` AND ci.type = $${params.length}`;
    }
    if (!manage) {
      where += ` AND ci.status = 'published'`;
      where += ` AND (ci.publish_start IS NULL OR ci.publish_start <= NOW())`;
      where += ` AND (ci.publish_end IS NULL OR ci.publish_end >= NOW())`;
    }
    const r = await pool.query(
      `
      SELECT ci.*,
        cf.mime_type AS cover_mime,
        mf.mime_type AS main_mime
      FROM pendencias.content_items ci
      LEFT JOIN pendencias.files cf ON cf.id = ci.cover_file_id AND cf.is_active = true
      LEFT JOIN pendencias.files mf ON mf.id = ci.main_file_id AND mf.is_active = true
      WHERE ${where}
      ORDER BY ci.display_order ASC, ci.created_at DESC
      LIMIT 200
    `,
      params
    );
    return NextResponse.json({ items: (r.rows || []).map(mapContentRow) });
  } catch (e) {
    console.error("[content.get]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !canManagePortalContent(session)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || "").trim();
    const title = String(body?.title || "").trim();
    if (!type || !title) return NextResponse.json({ error: "type e title obrigatórios" }, { status: 400 });

    const uuidOrNull = (v: unknown) => {
      const s = String(v || "").trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
    };

    await ensureStorageCatalogTables();
    const pool = getPool();
    const meta =
      body?.metadata_json && typeof body.metadata_json === "object" && !Array.isArray(body.metadata_json)
        ? body.metadata_json
        : {};
    const ins = await pool.query(
      `
      INSERT INTO pendencias.content_items (
        type, title, subtitle, description, cover_file_id, main_file_id, category, target_audience,
        publish_start, publish_end, is_featured, display_order, slug, status, created_by, metadata_json
      )
      VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid, $7, $8, $9::timestamptz, $10::timestamptz, $11, $12, $13, $14, $15, $16::jsonb)
      RETURNING *
    `,
      [
        type,
        title,
        body?.subtitle || null,
        body?.description || null,
        uuidOrNull(body?.cover_file_id),
        uuidOrNull(body?.main_file_id),
        body?.category || null,
        body?.target_audience || null,
        body?.publish_start || null,
        body?.publish_end || null,
        !!body?.is_featured,
        Number(body?.display_order) || 0,
        body?.slug || null,
        String(body?.status || "draft").trim() || "draft",
        session.username,
        JSON.stringify(meta),
      ]
    );
    return NextResponse.json({ item: mapContentRow(ins.rows?.[0] || {}) });
  } catch (e: any) {
    console.error("[content.post]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
