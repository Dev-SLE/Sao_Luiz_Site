import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { buildDossiePdf } from "../../../../lib/server/dossiePdf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (!can(session, "tab.operacional.dossie.view")) {
      return NextResponse.json({ error: "Sem permissão para o Dossiê" }, { status: 403 });
    }
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "0").trim() || "0";
    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });

    const pdf = await buildDossiePdf(pool, cte, serie);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dossie_${cte}_${serie}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[dossie.pdf]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
