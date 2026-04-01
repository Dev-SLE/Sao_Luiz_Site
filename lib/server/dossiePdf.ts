import type { Pool } from "pg";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const A4_W = 595;
const A4_H = 842;
const M = 50;
const LINE = 12;
const FS_BODY = 9.5;
const FS_SMALL = 8.5;
const FS_TITLE = 14;
const FS_SEC = 11;

const BRAND = rgb(0.047, 0.29, 0.431);
const ACCENT = rgb(0.925, 0.106, 0.141);
const TEXT = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.35, 0.38, 0.42);
const BOX_BORDER = rgb(0.85, 0.87, 0.9);
const BOX_BG = rgb(0.97, 0.98, 0.99);

const HEADER_BAND = 52;

function formatPtBr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** fromTop = distância do topo da página; retorna novo fromTop após o texto. */
function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  fromTop: number,
  maxW: number,
  font: PDFFont,
  size: number,
  color = TEXT,
  lineH = LINE
): number {
  const raw = String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!raw) return fromTop;

  let cur = fromTop;
  const paragraphs = raw.split(/\n+/);

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        page.drawText(line, { x, y: A4_H - cur - size, size, font, color });
        cur += lineH;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x, y: A4_H - cur - size, size, font, color });
      cur += lineH;
    }
    cur += 4;
  }
  return cur;
}

function drawSectionTitle(page: PDFPage, title: string, fromTop: number, fontBold: PDFFont): number {
  const t = fromTop + 4;
  page.drawText(title, { x: M, y: A4_H - t - FS_SEC, size: FS_SEC, font: fontBold, color: BRAND });
  const lineY = A4_H - t - FS_SEC - 5;
  page.drawLine({
    start: { x: M, y: lineY },
    end: { x: A4_W - M, y: lineY },
    thickness: 0.7,
    color: ACCENT,
  });
  return t + FS_SEC + 12;
}

function drawTopicBlock(
  page: PDFPage,
  fromTop: number,
  font: PDFFont,
  fontBold: PDFFont,
  topicTitle: string,
  body: string,
  maxW: number
): number {
  let cur = fromTop + 4;
  page.drawText(topicTitle, {
    x: M + 6,
    y: A4_H - cur - 9,
    size: 9.5,
    font: fontBold,
    color: BRAND,
  });
  cur += 12;
  cur = drawWrapped(page, body, M + 10, cur, maxW - 14, font, FS_BODY, TEXT);
  cur += 10;
  return cur;
}

async function drawLogoIfPresent(pdfDoc: PDFDocument, page: PDFPage): Promise<number> {
  const candidates = [
    path.join(process.cwd(), "public", "logo-dossie.png"),
    path.join(process.cwd(), "public", "logo.png"),
    path.join(process.cwd(), "public", "sle-logo.png"),
    path.join(process.cwd(), "logo_transparente.png"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const bytes = fs.readFileSync(p);
      const png = await pdfDoc.embedPng(bytes);
      const maxH = 34;
      const maxW = 100;
      const scale = Math.min(maxW / png.width, maxH / png.height, 1);
      const w = png.width * scale;
      const h = png.height * scale;
      const x = 12;
      const yBottom = A4_H - HEADER_BAND + (HEADER_BAND - h) / 2;
      page.drawImage(png, { x, y: yBottom, width: w, height: h });
      return Math.max(130, Math.ceil(x + w + 16));
    } catch {
      /* próximo */
    }
  }
  return 56;
}

async function drawBrandHeader(page: PDFPage, fontBold: PDFFont, font: PDFFont, pdfDoc: PDFDocument) {
  page.drawRectangle({ x: 0, y: A4_H - HEADER_BAND, width: A4_W, height: HEADER_BAND, color: BRAND });
  page.drawRectangle({ x: 0, y: A4_H - 3, width: A4_W, height: 3, color: ACCENT });
  const titleX = await drawLogoIfPresent(pdfDoc, page);
  page.drawText("São Luiz Express", {
    x: titleX,
    y: A4_H - 32,
    size: FS_TITLE,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Dossiê operacional / jurídico", {
    x: titleX,
    y: A4_H - 46,
    size: FS_SMALL,
    font,
    color: rgb(0.9, 0.92, 0.95),
  });
}

export async function buildDossiePdf(pool: Pool, cte: string, serie: string): Promise<Uint8Array> {
  const serieN = String(serie || "0").trim() || "0";

  const dossierRes = await pool.query(
    `SELECT id, title, status, finalization_status, finalized_at, generated_by
     FROM pendencias.dossiers
     WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
     LIMIT 1`,
    [cte, serieN]
  );
  const dossier = dossierRes.rows?.[0] || null;

  const occ = await pool.query(
    `SELECT id, occurrence_type, description, status, created_by, created_at
     FROM pendencias.occurrences
     WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
     ORDER BY created_at DESC LIMIT 50`,
    [cte, serieN]
  );
  const occRows = occ.rows || [];
  const occIds = occRows.map((r: any) => r.id).filter(Boolean);

  let indemRows: any[] = [];
  if (occIds.length > 0) {
    const indem = await pool.query(
      `SELECT status, amount, currency, decision, responsible, created_at,
              facts, responsibilities, indemnification_body, others, notes
       FROM pendencias.indemnifications
       WHERE occurrence_id = ANY($1::uuid[])
       ORDER BY created_at DESC LIMIT 20`,
      [occIds]
    );
    indemRows = indem.rows || [];
  }

  const noteRows =
    (
      await pool.query(
        `SELECT usuario, texto, status_busca, data
         FROM pendencias.notes
         WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
         ORDER BY data DESC NULLS LAST, id DESC LIMIT 80`,
        [cte, serieN]
      )
    ).rows || [];

  const procRows =
    (
      await pool.query(
        `SELECT user_name, description, status, data
         FROM pendencias.process_control
         WHERE cte = $1 AND (serie = $2 OR ltrim(serie,'0') = ltrim($2,'0'))
         ORDER BY data DESC NULLS LAST, id DESC LIMIT 60`,
        [cte, serieN]
      )
    ).rows || [];

  let eventRows: any[] = [];
  if (dossier?.id) {
    const ev = await pool.query(
      `SELECT event_type, event_date, actor, description
       FROM pendencias.dossier_events
       WHERE dossier_id = $1::uuid
       ORDER BY event_date DESC NULLS LAST, id DESC LIMIT 40`,
      [dossier.id]
    );
    eventRows = ev.rows || [];
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([A4_W, A4_H]);
  await drawBrandHeader(page, fontBold, font, pdfDoc);

  let fromTop = HEADER_BAND + 18;
  const maxW = A4_W - 2 * M;
  const bottomMin = M + 28;

  const newContinuationPage = () => {
    page = pdfDoc.addPage([A4_W, A4_H]);
    page.drawRectangle({ x: 0, y: A4_H - 36, width: A4_W, height: 36, color: BOX_BG });
    page.drawRectangle({ x: 0, y: A4_H - 3, width: A4_W, height: 3, color: ACCENT });
    page.drawText(`São Luiz Express · Dossiê (continuação) · CTE ${cte} · Série ${serieN}`, {
      x: M,
      y: A4_H - 24,
      size: FS_SMALL,
      font: fontBold,
      color: BRAND,
    });
    fromTop = 44;
  };

  const needSpace = (px: number) => {
    if (fromTop + px > A4_H - bottomMin) {
      newContinuationPage();
    }
  };

  /* 1. Identificação */
  needSpace(100);
  fromTop = drawSectionTitle(page, "1. Identificação do processo", fromTop, fontBold);
  const idH = 50;
  needSpace(idH + 20);
  page.drawRectangle({
    x: M,
    y: A4_H - fromTop - idH,
    width: maxW,
    height: idH,
    borderColor: BOX_BORDER,
    borderWidth: 0.8,
    color: BOX_BG,
  });
  const idLines = [
    `CTE: ${cte}    ·    Série: ${serieN}`,
    `Título do dossiê: ${dossier?.title || "—"}`,
    `Status: ${dossier?.status || "—"}${
      dossier?.finalization_status ? `    ·    Finalização: ${dossier.finalization_status} (${formatPtBr(dossier.finalized_at)})` : ""
    }`,
    `Gerado em: ${formatPtBr(new Date())}`,
  ];
  let idY = fromTop + 10;
  for (const ln of idLines) {
    page.drawText(ln, { x: M + 10, y: A4_H - idY - FS_BODY, size: FS_BODY, font, color: TEXT });
    idY += LINE;
  }
  fromTop = idY + 16;

  /* 2. Ocorrências */
  needSpace(60);
  fromTop = drawSectionTitle(page, "2. Ocorrências formais", fromTop, fontBold);
  if (!occRows.length) {
    fromTop = drawWrapped(page, "Nenhuma ocorrência formal registrada para este CTE/série.", M, fromTop, maxW, font, FS_BODY);
  } else {
    for (let i = 0; i < occRows.length; i++) {
      const r = occRows[i];
      needSpace(36);
      const head = `${i + 1}. [${String(r.occurrence_type || "—")}]  Status: ${String(r.status || "—")}  ·  ${formatPtBr(r.created_at)}`;
      page.drawText(head, { x: M, y: A4_H - fromTop - FS_BODY, size: FS_BODY, font: fontBold, color: TEXT });
      fromTop += LINE + 2;
      needSpace(24);
      fromTop = drawWrapped(page, String(r.description || "—"), M + 8, fromTop, maxW - 8, font, FS_BODY, MUTED);
      fromTop += 6;
    }
  }

  /* 3. Indenizações — tópicos */
  needSpace(60);
  fromTop = drawSectionTitle(page, "3. Indenizações (fatos, responsabilidades e valores)", fromTop, fontBold);
  if (!indemRows.length) {
    fromTop = drawWrapped(
      page,
      "Sem registro de indenização vinculado às ocorrências deste processo.",
      M,
      fromTop,
      maxW,
      font,
      FS_BODY
    );
  } else {
    for (let i = 0; i < indemRows.length; i++) {
      const r = indemRows[i];
      needSpace(48);
      const summary = `Registro ${i + 1} · Status: ${String(r.status || "—")} · ${formatPtBr(r.created_at)}`;
      page.drawText(summary, { x: M, y: A4_H - fromTop - FS_BODY, size: FS_BODY, font: fontBold, color: TEXT });
      fromTop += LINE + 10;

      fromTop = drawTopicBlock(page, fromTop, font, fontBold, "Dos fatos", String(r.facts || "—"), maxW);
      needSpace(40);
      fromTop = drawTopicBlock(page, fromTop, font, fontBold, "Das responsabilidades", String(r.responsibilities || "—"), maxW);
      needSpace(40);
      fromTop = drawTopicBlock(page, fromTop, font, fontBold, "Da indenização", String(r.indemnification_body || "—"), maxW);
      needSpace(40);
      fromTop = drawTopicBlock(page, fromTop, font, fontBold, "Outros", String(r.others || "—"), maxW);

      const amt =
        r.amount != null && r.amount !== ""
          ? `Valor: ${Number(r.amount).toLocaleString("pt-BR", { style: "currency", currency: String(r.currency || "BRL") })}`
          : "";
      const bits = [amt, r.decision ? `Decisão: ${r.decision}` : "", r.responsible ? `Responsável: ${r.responsible}` : "", r.notes ? `Observações: ${r.notes}` : ""].filter(
        Boolean
      );
      if (bits.length) {
        needSpace(24);
        fromTop = drawWrapped(page, bits.join("  ·  "), M, fromTop, maxW, font, FS_SMALL, MUTED);
      }
      fromTop += 12;
    }
  }

  /* 4. Eventos do dossiê */
  if (eventRows.length) {
    needSpace(60);
    fromTop = drawSectionTitle(page, "4. Linha do tempo do dossiê", fromTop, fontBold);
    for (let i = 0; i < eventRows.length; i++) {
      const e = eventRows[i];
      needSpace(32);
      const line = `• ${String(e.event_type || "—")} — ${formatPtBr(e.event_date)}${e.actor ? ` · ${e.actor}` : ""}`;
      page.drawText(line, { x: M, y: A4_H - fromTop - FS_BODY, size: FS_BODY, font: fontBold, color: TEXT });
      fromTop += LINE;
      needSpace(20);
      fromTop = drawWrapped(page, String(e.description || ""), M + 8, fromTop, maxW - 8, font, FS_SMALL, MUTED);
    }
  }

  /* Processo operacional */
  needSpace(60);
  const nProc = eventRows.length ? "5" : "4";
  fromTop = drawSectionTitle(page, `${nProc}. Processo operacional (rastreamento)`, fromTop, fontBold);
  if (!procRows.length) {
    fromTop = drawWrapped(page, "Nenhum evento em process_control para este CTE/série.", M, fromTop, maxW, font, FS_BODY);
  } else {
    for (let i = 0; i < procRows.length; i++) {
      const r = procRows[i];
      needSpace(36);
      const h = `${i + 1}. ${String(r.status || "—")}  ·  ${formatPtBr(r.data)}  ·  ${String(r.user_name || "—")}`;
      page.drawText(h, { x: M, y: A4_H - fromTop - FS_BODY, size: FS_BODY, font: fontBold, color: TEXT });
      fromTop += LINE;
      needSpace(20);
      fromTop = drawWrapped(page, String(r.description || "—"), M + 8, fromTop, maxW - 8, font, FS_BODY, MUTED);
    }
  }

  /* Notas — texto completo com quebra */
  needSpace(60);
  const nNotes = eventRows.length ? "6" : "5";
  fromTop = drawSectionTitle(page, `${nNotes}. Notas e anotações`, fromTop, fontBold);
  if (!noteRows.length) {
    fromTop = drawWrapped(page, "Nenhuma nota registrada.", M, fromTop, maxW, font, FS_BODY);
  } else {
    for (let i = 0; i < noteRows.length; i++) {
      const r = noteRows[i];
      needSpace(40);
      const meta = `Nota ${i + 1}  ·  ${String(r.usuario || "—")}  ·  ${formatPtBr(r.data)}  ·  ${String(r.status_busca || "—")}`;
      page.drawText(meta, { x: M, y: A4_H - fromTop - FS_BODY, size: FS_BODY, font: fontBold, color: TEXT });
      fromTop += LINE + 4;
      needSpace(30);
      fromTop = drawWrapped(page, String(r.texto || "—"), M + 6, fromTop, maxW - 6, font, FS_BODY, TEXT);
      fromTop += 10;
    }
  }

  needSpace(36);
  page.drawLine({
    start: { x: M, y: A4_H - fromTop },
    end: { x: A4_W - M, y: A4_H - fromTop },
    thickness: 0.4,
    color: BOX_BORDER,
  });
  fromTop += 12;
  fromTop = drawWrapped(
    page,
    "Observação: este documento resume históricos operacionais para fins de resguardo. Conferir sempre os registros no sistema.",
    M,
    fromTop,
    maxW,
    font,
    FS_SMALL,
    MUTED
  );

  return pdfDoc.save();
}
