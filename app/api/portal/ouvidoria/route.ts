import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureFase1InfrastructureTables } from "@/lib/server/ensureFase1Infrastructure";
import { can, getSessionContext } from "@/lib/server/authorization";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["reclamacao", "denuncia", "sugestao", "elogio"]);

/** Registra manifestação de ouvidoria (persistência real; sem protocolo fictício). */
export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "portal.suporte.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const manifestationType = String(body?.manifestationType || "").trim();
    if (!ALLOWED_KINDS.has(manifestationType)) {
      return NextResponse.json({ error: "Tipo de manifestação inválido" }, { status: 400 });
    }
    const subject = String(body?.subject || "").trim();
    const description = String(body?.description || "").trim();
    if (!subject || !description) {
      return NextResponse.json({ error: "Assunto e descrição são obrigatórios" }, { status: 400 });
    }
    const anonymous = !!body?.anonymous;
    const name = anonymous ? null : String(body?.name || "").trim() || null;
    const sector = anonymous ? null : String(body?.sector || "").trim() || null;

    const payload = {
      manifestationType,
      anonymous,
      name,
      sector,
      subject,
      description,
    };

    await ensureFase1InfrastructureTables();
    const pool = getPool();
    const ins = await pool.query(
      `
      INSERT INTO pendencias.portal_submissions (channel, username, status, payload)
      VALUES ('ouvidoria', $1, 'received', $2::jsonb)
      RETURNING id::text
    `,
      [session.username, JSON.stringify(payload)]
    );
    const id = ins.rows?.[0]?.id as string | undefined;
    if (!id) return NextResponse.json({ error: "Falha ao gravar" }, { status: 500 });

    return NextResponse.json({
      ok: true,
      protocol: id,
      protocolShort: id.replace(/-/g, "").slice(0, 12).toUpperCase(),
    });
  } catch (e) {
    console.error("[portal.ouvidoria.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
