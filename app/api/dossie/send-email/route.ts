import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { buildDossiePdf } from "../../../../lib/server/dossiePdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view") || !can(session, "tab.operacional.dossie.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "0").trim() || "0";
    const to = String(body?.to || "").trim();
    if (!cte || !to) return NextResponse.json({ error: "cte e to (e-mail) obrigatórios" }, { status: 400 });

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.SMTP_FROM?.trim() || user;

    if (!host || !from) {
      return NextResponse.json(
        {
          error: "SMTP não configurado",
          hint: "Defina SMTP_HOST, SMTP_FROM e credenciais no ambiente, ou use Baixar PDF e anexe manualmente no Outlook.",
        },
        { status: 501 }
      );
    }

    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const pdfBytes = await buildDossiePdf(pool, cte, serie);
    const buffer = Buffer.from(pdfBytes);
    const fname = `dossie_${cte}_${serie}.pdf`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    const subject = String(body?.subject || "").trim() || `Dossiê operacional CTE ${cte} / Série ${serie}`;
    const text =
      String(body?.text || "").trim() ||
      `Segue em anexo o dossiê em PDF referente ao CTE ${cte} / Série ${serie}.\n\nEnviado por ${session.username} via sistema operacional.`;

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      attachments: [{ filename: fname, content: buffer, contentType: "application/pdf" }],
    });

    const dossRes = await pool.query(
      `SELECT id FROM pendencias.dossiers WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0')) LIMIT 1`,
      [cte, serie]
    );
    const did = dossRes.rows?.[0]?.id;
    if (did) {
      await pool.query(
        `INSERT INTO pendencias.dossier_events (dossier_id, event_type, actor, description, metadata)
         VALUES ($1::uuid, 'EMAIL_ENVIADO', $2, $3, $4::jsonb)`,
        [did, session.username, `E-mail com PDF enviado para ${to}`, JSON.stringify({ to })]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[dossie.send-email]", e);
    return NextResponse.json({ error: e?.message || "Erro ao enviar e-mail" }, { status: 500 });
  }
}
