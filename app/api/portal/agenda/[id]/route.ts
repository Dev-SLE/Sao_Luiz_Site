import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureFase1InfrastructureTables } from "@/lib/server/ensureFase1Infrastructure";
import { getSessionContext } from "@/lib/server/authorization";
import { canManagePortalContent } from "@/lib/server/portalContentPermissions";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionContext(req);
    if (!session || !canManagePortalContent(session)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await ensureFase1InfrastructureTables();
    const pool = getPool();

    const cur = await pool.query(`SELECT * FROM pendencias.portal_content WHERE id = $1::uuid AND kind = 'agenda' LIMIT 1`, [id]);
    const row = cur.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const title = "title" in body ? String(body.title || "").trim() : String(row.title || "");
    if (!title) return NextResponse.json({ error: "title inválido" }, { status: 400 });

    let publishedAt = row.published_at as string;
    if (body?.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(String(body.eventDate))) {
      publishedAt = `${body.eventDate}T12:00:00`;
    }

    const prevMeta = (row.metadata as Record<string, unknown>) || {};
    const meta = {
      timeRange: body?.timeRange !== undefined ? String(body.timeRange || "").trim() || null : prevMeta.timeRange ?? null,
      location: body?.location !== undefined ? String(body.location || "").trim() || null : prevMeta.location ?? null,
      eventType: body?.eventType !== undefined ? String(body.eventType || "event").trim() : prevMeta.eventType || "event",
      color: body?.color !== undefined ? String(body.color || "border-l-sl-red").trim() : prevMeta.color || "border-l-sl-red",
    };

    const nextBody = body?.body !== undefined ? (body.body === null || body.body === '' ? null : String(body.body)) : row.body;
    const nextHref = body?.href !== undefined ? (body.href === null || body.href === '' ? null : String(body.href)) : row.href;

    const r = await pool.query(
      `
      UPDATE pendencias.portal_content
      SET title = $2,
          body = $3,
          href = $4,
          metadata = $5::jsonb,
          published_at = $6::timestamptz
      WHERE id = $1::uuid AND kind = 'agenda'
      RETURNING id::text, kind, title, body, href, metadata, published_at, created_by
    `,
      [id, title, nextBody, nextHref, JSON.stringify(meta), publishedAt]
    );
    return NextResponse.json({ item: r.rows?.[0] || null });
  } catch (e: any) {
    console.error("[portal.agenda.patch]", e);
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
    await ensureFase1InfrastructureTables();
    const pool = getPool();
    const r = await pool.query(`DELETE FROM pendencias.portal_content WHERE id = $1::uuid AND kind = 'agenda' RETURNING id`, [id]);
    if (!r.rows?.[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[portal.agenda.delete]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
