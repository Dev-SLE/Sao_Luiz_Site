import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureOccurrencesSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

function escapePdfText(input: string) {
  return String(input || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function simplePdf(lines: string[]) {
  const body = lines.map((l, idx) => `BT /F1 10 Tf 40 ${800 - idx * 14} Td (${escapePdfText(l)}) Tj ET`).join("\n");
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${body.length} >>
stream
${body}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000120 00000 n 
0000000240 00000 n 
0000000310 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`;
  return new TextEncoder().encode(content);
}

export async function GET(req: Request) {
  try {
    await ensureOccurrencesSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "0").trim() || "0";
    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });
    const occ = await pool.query(
      `SELECT occurrence_type, description, status, created_by, created_at FROM pendencias.occurrences
       WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
       ORDER BY created_at DESC LIMIT 50`,
      [cte, serie]
    );
    const lines = [
      `Dossie operacional - CTE ${cte} / Serie ${serie}`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      "Resumo de ocorrencias:",
      ...((occ.rows || []).map((r: any, i: number) =>
        `${i + 1}. [${String(r.occurrence_type || "")}] ${String(r.status || "")} - ${String(r.description || "").slice(0, 120)}`
      )),
    ];
    const pdf = simplePdf(lines);
    return new NextResponse(pdf, {
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
