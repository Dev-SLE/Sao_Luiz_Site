import { NextResponse } from "next/server";
import { getCommercialPool } from "../../../../../lib/server/db";
import { ensureCommercialTables } from "../../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureCommercialTables();
    const { searchParams } = new URL(req.url);
    const auditoriaId = Number(searchParams.get("auditoriaId") || 0);
    if (!Number.isFinite(auditoriaId) || auditoriaId <= 0) {
      return NextResponse.json({ error: "auditoriaId inválido" }, { status: 400 });
    }
    const pool = getCommercialPool();
    const res = await pool.query(
      `
        SELECT id, auditoria_id, acao, actor, note, previous_status, next_status, created_at
        FROM public.tb_auditoria_metas_historico
        WHERE auditoria_id = $1
        ORDER BY created_at DESC
        LIMIT 300
      `,
      [auditoriaId]
    );
    return NextResponse.json({
      rows: (res.rows || []).map((r: any) => ({
        id: Number(r.id),
        auditoriaId: Number(r.auditoria_id),
        acao: String(r.acao || ""),
        actor: r.actor ? String(r.actor) : "",
        note: r.note ? String(r.note) : "",
        previousStatus: r.previous_status ? String(r.previous_status) : "",
        nextStatus: r.next_status ? String(r.next_status) : "",
        createdAt: r.created_at ? String(r.created_at) : null,
      })),
    });
  } catch (error) {
    console.error("Comercial auditoria history GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar histórico da auditoria" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCommercialTables();
    const body = await req.json().catch(() => ({}));
    const auditoriaId = Number(body?.auditoriaId || 0);
    if (!Number.isFinite(auditoriaId) || auditoriaId <= 0) {
      return NextResponse.json({ error: "auditoriaId inválido" }, { status: 400 });
    }
    const acao = String(body?.acao || "REGISTRO_RETORNO").trim();
    const actor = body?.actor != null ? String(body.actor) : "";
    const note = body?.note != null ? String(body.note) : "";
    const pool = getCommercialPool();
    await pool.query(
      `
        INSERT INTO public.tb_auditoria_metas_historico
        (auditoria_id, acao, actor, note, created_at)
        VALUES ($1, $2, NULLIF($3,''), $4, NOW())
      `,
      [auditoriaId, acao, actor, note]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Comercial auditoria history POST error:", error);
    return NextResponse.json({ error: "Erro ao registrar histórico da auditoria" }, { status: 500 });
  }
}

