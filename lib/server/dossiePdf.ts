import type { Pool } from "pg";

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

export async function buildDossiePdf(pool: Pool, cte: string, serie: string): Promise<Uint8Array> {
  const occ = await pool.query(
    `SELECT id, occurrence_type, description, status, created_by, created_at FROM pendencias.occurrences
     WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
     ORDER BY created_at DESC LIMIT 50`,
    [cte, serie]
  );
  const occRows = occ.rows || [];
  const occIds = occRows.map((r: any) => r.id).filter(Boolean);
  let indemRows: any[] = [];
  if (occIds.length > 0) {
    const indem = await pool.query(
      `SELECT status, amount, currency, decision, responsible, created_at
       FROM pendencias.indemnifications
       WHERE occurrence_id = ANY($1::uuid[])
       ORDER BY created_at DESC LIMIT 30`,
      [occIds]
    );
    indemRows = indem.rows || [];
  }
  const noteRows = (
    await pool.query(
      `SELECT usuario, texto, status_busca, data
       FROM pendencias.notes
       WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
       ORDER BY data DESC LIMIT 30`,
      [cte, serie]
    )
  ).rows || [];
  const procRows = (
    await pool.query(
      `SELECT user_name, description, status, data
       FROM pendencias.process_control
       WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
       ORDER BY data DESC LIMIT 30`,
      [cte, serie]
    )
  ).rows || [];

  const totalOcorrencias = occRows.length;
  const totalIndenizacoes = indemRows.length;
  const totalNotas = noteRows.length;
  const totalProcesso = procRows.length;
  const lines = [
    `Dossie operacional/juridico - CTE ${cte} / Serie ${serie}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Resumo: ocorrencias=${totalOcorrencias} | indenizacoes=${totalIndenizacoes} | notas=${totalNotas} | eventos_processo=${totalProcesso}`,
    " ",
    "Fatos relevantes (ocorrencias):",
    ...occRows.slice(0, 12).map((r: any, i: number) =>
      `${i + 1}. [${String(r.occurrence_type || "")}] ${String(r.status || "")} - ${String(r.description || "").slice(0, 100)}`
    ),
    " ",
    "Indenizacoes:",
    ...(indemRows.length
      ? indemRows.slice(0, 8).map((r: any, i: number) =>
          `${i + 1}. ${String(r.status || "")} | ${String(r.amount || "")} ${String(r.currency || "")} | Resp: ${String(r.responsible || "-")}`
        )
      : ["1. Sem indenizacao registrada ate o momento."]),
    " ",
    "Timeline operacional (process_control):",
    ...(procRows.length
      ? procRows.slice(0, 8).map((r: any, i: number) =>
          `${i + 1}. ${String(r.status || "")} - ${String(r.description || "").slice(0, 90)}`
        )
      : ["1. Sem eventos de processo registrados."]),
    " ",
    "Notas/anotacoes:",
    ...(noteRows.length
      ? noteRows.slice(0, 8).map((r: any, i: number) =>
          `${i + 1}. ${String(r.status_busca || "-")} - ${String(r.texto || "").slice(0, 90)}`
        )
      : ["1. Sem notas registradas."]),
    " ",
    "Observacao: este documento resume historicos operacionais para resguardo.",
  ];
  return simplePdf(lines);
}
