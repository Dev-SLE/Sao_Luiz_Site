import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureFase1InfrastructureTables } from "@/lib/server/ensureFase1Infrastructure";
import { can, getSessionContext } from "@/lib/server/authorization";
import { canManagePortalContent } from "@/lib/server/portalContentPermissions";

export const runtime = "nodejs";

/** Eventos exibidos na agenda do portal (`portal_content` com kind = agenda). */
export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (!can(session, "portal.agenda.view")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    await ensureFase1InfrastructureTables();
    const pool = getPool();
    const r = await pool.query(
      `
      SELECT id::text, kind, title, body, href, metadata, published_at, created_by
      FROM pendencias.portal_content
      WHERE kind = 'agenda'
      ORDER BY published_at ASC NULLS LAST, id ASC
      LIMIT 200
    `
    );
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error("[portal.agenda.get]", e);
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
    const title = String(body?.title || "").trim();
    if (!title) return NextResponse.json({ error: "title obrigatório" }, { status: 400 });
    const eventDate = String(body?.eventDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return NextResponse.json({ error: "eventDate deve ser YYYY-MM-DD" }, { status: 400 });
    }
    const publishedAt = `${eventDate}T12:00:00`;
    const metadata = {
      timeRange: String(body?.timeRange || "").trim() || null,
      location: String(body?.location || "").trim() || null,
      eventType: String(body?.eventType || "event").trim() || "event",
      color: String(body?.color || "border-l-sl-red").trim() || "border-l-sl-red",
    };
    await ensureFase1InfrastructureTables();
    const pool = getPool();
    const ins = await pool.query(
      `
      INSERT INTO pendencias.portal_content (kind, title, body, href, metadata, published_at, created_by)
      VALUES ('agenda', $1, $2, $3, $4::jsonb, $5::timestamptz, $6)
      RETURNING id::text, kind, title, body, href, metadata, published_at, created_by
    `,
      [title, body?.body || null, body?.href || null, JSON.stringify(metadata), publishedAt, session.username]
    );
    return NextResponse.json({ item: ins.rows?.[0] || null });
  } catch (e: any) {
    console.error("[portal.agenda.post]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
