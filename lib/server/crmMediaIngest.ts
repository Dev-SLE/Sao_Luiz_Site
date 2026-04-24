import type { Pool } from "pg";
import { uploadFileToSharePoint } from "@/modules/storage/fileService";
import {
  evolutionGetBase64FromMediaMessage,
  evolutionWebhookRootMessageType,
} from "@/lib/server/evolutionClient";
import { crmEvolutionMediaDebugEnabled } from "@/lib/server/crmEvolutionDebug";
import {
  getCrmMediaSettings,
  isMimeAllowedForMediaType,
  maxUploadBytesForMediaType,
} from "@/lib/server/crmMediaSettings";
import { maybeTranscodeInboundAudio } from "@/lib/server/crmMediaTranscode";

const META_GRAPH = "https://graph.facebook.com/v23.0";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function mapWaTypeToMediaType(waType: string): string {
  const t = String(waType || "").toLowerCase();
  if (["image", "audio", "video", "document", "sticker"].includes(t)) return t;
  return "unknown";
}

export function inferMediaCategoryFromMimeOrHint(mime: string, hint?: string | null): string {
  const m = String(mime || "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  const h = String(hint || "").toLowerCase();
  if (["image", "audio", "video", "document", "sticker"].includes(h)) return h;
  if (m === "application/pdf" || m.includes("word") || m.includes("excel") || m.includes("sheet")) return "document";
  return "document";
}

function extFromMime(mime: string): string {
  const m = String(mime || "").toLowerCase();
  if (m.includes("jpeg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("webm")) return "webm";
  if (m.includes("wav")) return "wav";
  if (m.includes("aac")) return "aac";
  if (m.includes("amr")) return "amr";
  if (m.includes("spreadsheetml")) return "xlsx";
  if (m.includes("wordprocessingml")) return "docx";
  return "bin";
}

function inferMimeFromFileName(fileName: string | null | undefined): string | null {
  const n = String(fileName || "").toLowerCase().trim();
  if (!n || !n.includes(".")) return null;
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".ogg") || n.endsWith(".opus")) return "audio/ogg";
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".pdf")) return "application/pdf";
  return null;
}

function inferMimeFromSignature(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "application/pdf";
  return null;
}

function resolveEvolutionMime(args: {
  mimeFromBase64: string | null | undefined;
  mimeFromSlot: string | null | undefined;
  fileName: string | null | undefined;
  buffer: Buffer;
  mediaType: string;
}): { mime: string; source: "base64" | "slot" | "filename" | "signature" | "fallback" } {
  const fromBase64 = String(args.mimeFromBase64 || "").trim().toLowerCase();
  if (fromBase64 && fromBase64 !== "application/octet-stream") {
    return { mime: fromBase64, source: "base64" };
  }
  const fromSlot = String(args.mimeFromSlot || "").trim().toLowerCase();
  if (fromSlot && fromSlot !== "application/octet-stream") {
    return { mime: fromSlot, source: "slot" };
  }
  const fromName = inferMimeFromFileName(args.fileName);
  if (fromName) return { mime: fromName, source: "filename" };
  const fromSig = inferMimeFromSignature(args.buffer);
  if (fromSig) return { mime: fromSig, source: "signature" };
  if (args.mediaType === "image" || args.mediaType === "sticker") return { mime: "image/webp", source: "fallback" };
  if (args.mediaType === "audio") return { mime: "audio/ogg", source: "fallback" };
  if (args.mediaType === "video") return { mime: "video/mp4", source: "fallback" };
  return { mime: "application/octet-stream", source: "fallback" };
}

async function downloadMetaMedia(accessToken: string, mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  suggestedName: string;
}> {
  let lastErr = "meta_download_failed";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const infoResp = await fetch(`${META_GRAPH}/${encodeURIComponent(mediaId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const infoJson = (await infoResp.json().catch(() => ({}))) as any;
      if (!infoResp.ok) {
        throw new Error(String(infoJson?.error?.message || `meta_media_info_http_${infoResp.status}`));
      }
      const url = String(infoJson?.url || "").trim();
      if (!url) throw new Error("meta_media_sem_url");
      const binResp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!binResp.ok) {
        throw new Error(`meta_media_download_http_${binResp.status}`);
      }
      const buffer = Buffer.from(await binResp.arrayBuffer());
      const mimeType =
        String(infoJson?.mime_type || "").trim() || binResp.headers.get("content-type") || "application/octet-stream";
      const ext = extFromMime(mimeType);
      return { buffer, mimeType, suggestedName: `wa_${mediaId}.${ext}` };
    } catch (e: any) {
      lastErr = String(e?.message || e);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw new Error(lastErr);
}

export function unwrapEvolutionInner(msg: any): any {
  if (!msg || typeof msg !== "object") return msg;
  if (msg.message && typeof msg.message === "object") return unwrapEvolutionInner(msg.message);
  if (msg.deviceSentMessage?.message) return unwrapEvolutionInner(msg.deviceSentMessage.message);
  if (msg.ephemeralMessage?.message) return unwrapEvolutionInner(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapEvolutionInner(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapEvolutionInner(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessageV2Extension?.message) return unwrapEvolutionInner(msg.viewOnceMessageV2Extension.message);
  if (msg.protocolMessage?.editedMessage?.message) return unwrapEvolutionInner(msg.protocolMessage.editedMessage.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapEvolutionInner(msg.documentWithCaptionMessage.message);
  if (msg.editedMessage?.message) return unwrapEvolutionInner(msg.editedMessage.message);
  return msg;
}

const DEEP_INGESTIBLE_MEDIA_KEYS = [
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "pttMessage",
  "ptvMessage",
] as const;

function findFirstDeepIngestibleMediaBlock(
  root: unknown,
  depth: number,
  seen: WeakSet<object>
): { key: (typeof DEEP_INGESTIBLE_MEDIA_KEYS)[number]; block: Record<string, unknown> } | null {
  if (depth > 16 || root == null || typeof root !== "object") return null;
  if (seen.has(root as object)) return null;
  seen.add(root as object);
  const o = root as Record<string, unknown>;
  for (const k of DEEP_INGESTIBLE_MEDIA_KEYS) {
    const v = o[k];
    if (v && typeof v === "object") return { key: k, block: v as Record<string, unknown> };
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      const hit = findFirstDeepIngestibleMediaBlock(v, depth + 1, seen);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Alguns payloads colocam `imageMessage`/`audioMessage` profundamente (fora do que `unwrapEvolutionInner` cobre)
 * enquanto `message` superficial só tem `conversation`/`extendedTextMessage` — o diag via árvore vê mídia, o ingest não.
 * Promove o primeiro bloco de mídia encontrado para irmão de `conversation` em `message`/`msg`.
 */
export function mergeDeepMediaIntoEvolutionItem(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const hit = findFirstDeepIngestibleMediaBlock(item, 0, new WeakSet());
  if (!hit) return item;
  const it = item as Record<string, unknown>;
  const prevMsg = (it.message ?? it.msg) as Record<string, unknown> | undefined;
  const baseMsg =
    prevMsg && typeof prevMsg === "object"
      ? { ...prevMsg, [hit.key]: (prevMsg as Record<string, unknown>)[hit.key] ?? hit.block }
      : { [hit.key]: hit.block };
  return { ...it, message: baseMsg, msg: baseMsg };
}

/** Lista proto de mídia ingestível presente em qualquer profundidade (para logs / gates). */
export function extractEvolutionIngestibleMediaProtoHints(root: unknown): string[] {
  const found = new Set<string>();
  const seen = new WeakSet<object>();
  function walk(node: unknown, depth: number) {
    if (depth > 16 || node == null || typeof node !== "object") return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    const o = node as Record<string, unknown>;
    for (const k of DEEP_INGESTIBLE_MEDIA_KEYS) {
      if (o[k] && typeof o[k] === "object") found.add(k);
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  }
  walk(root, 0);
  return [...found];
}

export type EvolutionMediaSlot = {
  mediaType: string;
  /** Chave proto (ex.: pttMessage) enviada à Evolution getBase64 */
  protoKey: string;
  mimeType: string | null;
  fileName: string | null;
  seconds: number | null;
  width: number | null;
  height: number | null;
  providerMediaKey: string;
  /** Bloco bruto (imageMessage, etc.) para getBase64 */
  mediaBlock: Record<string, unknown>;
};

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Slots enviados ao getBase64 + SharePoint.
 * Figurinhas (sticker / lottie) **não** entram: a Evolution não trata `lottieStickerMessage` no TypeMediaMessage
 * e o CRM usa só texto/cartão [[MediaPlaceholderHint]] no chat. Foco em imagem, vídeo, áudio, documento.
 */
function collectEvolutionMediaSlots(inner: any, fallbackMsgId: string): EvolutionMediaSlot[] {
  const m = unwrapEvolutionInner(inner);
  const out: EvolutionMediaSlot[] = [];
  let idx = 0;
  const push = (
    mediaType: string,
    protoKey: string,
    block: any,
    pick: (b: any) => {
      mime: string | null;
      fileName: string | null;
      seconds: number | null;
      w: number | null;
      h: number | null;
      key: string;
    }
  ) => {
    if (!block || typeof block !== "object") return;
    const meta = pick(block);
    out.push({
      mediaType,
      protoKey,
      mimeType: meta.mime,
      fileName: meta.fileName,
      seconds: meta.seconds,
      width: meta.w,
      height: meta.h,
      providerMediaKey: meta.key,
      mediaBlock: block as Record<string, unknown>,
    });
  };

  push("image", "imageMessage", m.imageMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : null,
    fileName: b.fileName ? String(b.fileName) : null,
    seconds: numOrNull(b.seconds),
    w: numOrNull(b.width),
    h: numOrNull(b.height),
    key: String(b.fileEncSha256 || b.fileSha256 || `img_${fallbackMsgId}_${idx++}`),
  }));
  push("video", "videoMessage", m.videoMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : null,
    fileName: b.fileName ? String(b.fileName) : null,
    seconds: numOrNull(b.seconds),
    w: numOrNull(b.width),
    h: numOrNull(b.height),
    key: String(b.fileEncSha256 || b.fileSha256 || `vid_${fallbackMsgId}_${idx++}`),
  }));
  push("video", "ptvMessage", m.ptvMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : "video/mp4",
    fileName: "video-note.mp4",
    seconds: numOrNull(b.seconds),
    w: numOrNull(b.width),
    h: numOrNull(b.height),
    key: String(b.fileEncSha256 || b.fileSha256 || `ptv_${fallbackMsgId}_${idx++}`),
  }));
  {
    const pttBlock =
      m.pttMessage && typeof m.pttMessage === "object" && Object.keys(m.pttMessage).length
        ? m.pttMessage
        : null;
    const audioBlock =
      m.audioMessage && typeof m.audioMessage === "object" && Object.keys(m.audioMessage).length
        ? m.audioMessage
        : null;
    /** Evitar dois slots (áudio + PTT) para a mesma nota de voz — o segundo costuma dar 400 no getBase64. */
    if (pttBlock && audioBlock) {
      push("audio", "pttMessage", pttBlock, (b) => ({
        mime: b.mimetype ? String(b.mimetype) : null,
        fileName: "voice.ptt",
        seconds: numOrNull(b.seconds),
        w: null,
        h: null,
        key: String(b.fileEncSha256 || b.fileSha256 || `ptt_${fallbackMsgId}_${idx++}`),
      }));
    } else if (pttBlock) {
      push("audio", "pttMessage", pttBlock, (b) => ({
        mime: b.mimetype ? String(b.mimetype) : null,
        fileName: "voice.ptt",
        seconds: numOrNull(b.seconds),
        w: null,
        h: null,
        key: String(b.fileEncSha256 || b.fileSha256 || `ptt_${fallbackMsgId}_${idx++}`),
      }));
    } else if (audioBlock) {
      push("audio", "audioMessage", audioBlock, (b) => ({
        mime: b.mimetype ? String(b.mimetype) : null,
        fileName: b.ptt ? "voice.opus" : "audio.bin",
        seconds: numOrNull(b.seconds),
        w: null,
        h: null,
        key: String(b.fileEncSha256 || b.fileSha256 || `aud_${fallbackMsgId}_${idx++}`),
      }));
    }
  }
  push("document", "documentMessage", m.documentMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : null,
    fileName: b.fileName ? String(b.fileName) : null,
    seconds: null,
    w: null,
    h: null,
    key: String(b.fileEncSha256 || b.fileSha256 || `doc_${fallbackMsgId}_${idx++}`),
  }));

  return out;
}

/**
 * Alguns `messages.upsert` trazem `message` vazio / só contexto, com `messageType` já definido (imagem, etc.).
 * A Evolution consegue reidratar o binário com `getBase64FromMediaMessage` usando só a `key`.
 */
function inferKeyOnlyEvolutionMediaSlots(evolutionItem: unknown, fallbackMsgId: string): EvolutionMediaSlot[] {
  const it = evolutionItem as { message?: unknown; msg?: unknown } | null;
  const inner = it?.message ?? it?.msg ?? null;
  if (inner && typeof inner === "object") {
    const raw = unwrapEvolutionInner(inner) as Record<string, unknown>;
    const keys = Object.keys(raw || {}).filter((k) => k !== "messageContextInfo");
    /** Só `conversation`/`extendedTextMessage` não impedem key-only: mídia pode vir só em `messageType` na raiz. */
    const textualOnly = new Set(["conversation", "extendedTextMessage"]);
    const substantive = keys.filter((k) => !textualOnly.has(k));
    if (substantive.length) return [];
  }

  const mt = evolutionWebhookRootMessageType(evolutionItem).toLowerCase();
  const fid = String(fallbackMsgId || "x").slice(0, 80);
  const mk = (
    prefix: string,
    protoKey: EvolutionMediaSlot["protoKey"],
    mediaType: EvolutionMediaSlot["mediaType"]
  ): EvolutionMediaSlot => ({
    mediaType,
    protoKey,
    mimeType: null,
    fileName: null,
    seconds: null,
    width: null,
    height: null,
    providerMediaKey: `${prefix}_${fid}`,
    mediaBlock: {},
  });

  if (mt.includes("lottie")) return [];
  if (mt.includes("sticker") && !mt.includes("pack")) return [];
  if (mt.includes("image")) return [mk("keyonly_img", "imageMessage", "image")];
  if (mt.includes("ptv")) return [mk("keyonly_ptv", "ptvMessage", "video")];
  if (mt.includes("video")) return [mk("keyonly_vid", "videoMessage", "video")];
  if (mt.includes("audio") || mt.includes("ptt")) return [mk("keyonly_aud", "pttMessage", "audio")];
  if (mt.includes("document") || mt.includes("file")) return [mk("keyonly_doc", "documentMessage", "document")];
  return [];
}

/**
 * Chave proto no body do `getBase64FromMediaMessage`.
 * Na Evolution (`src/api/types/wa.types.ts`), `TypeMediaMessage` **não inclui**
 * `lottieStickerMessage` nem `pttMessage` — só `stickerMessage`, `audioMessage`, etc.
 * Sem este mapeamento, figurinha animada (.tgs) e PTT falham com "not of the media type".
 */
function effectiveEvolutionProtoKeyForGetBase64(args: {
  slot: EvolutionMediaSlot;
  evolutionItem: unknown;
}): string {
  const root = evolutionWebhookRootMessageType(args.evolutionItem).toLowerCase();
  let pk = String(args.slot.protoKey || "");
  if (root.includes("lottie") && pk === "imageMessage") pk = "lottieStickerMessage";
  if (root.includes("sticker") && pk === "imageMessage") pk = "stickerMessage";
  if (pk === "lottieStickerMessage") return "stickerMessage";
  if (pk === "pttMessage") return "audioMessage";
  return pk;
}

/** Conta slots de mídia ingestíveis (imagem, vídeo, áudio, doc — sem figurinha). */
export function countEvolutionInboundMediaSlots(
  evolutionItem: unknown,
  fallbackMsgId: string,
  /** Se true, `evolutionItem` já passou por `mergeDeepMediaIntoEvolutionItem` (evita dupla fusão). */
  alreadyMerged?: boolean
): number {
  const prepared = (alreadyMerged ? evolutionItem : mergeDeepMediaIntoEvolutionItem(evolutionItem)) as {
    message?: unknown;
    msg?: unknown;
  } | null;
  const it = prepared as { message?: unknown; msg?: unknown } | null;
  const inner = it?.message ?? it?.msg ?? prepared;
  const n = collectEvolutionMediaSlots(inner, String(fallbackMsgId || "x")).length;
  if (n) return n;
  return inferKeyOnlyEvolutionMediaSlots(prepared, String(fallbackMsgId || "x")).length;
}

async function upsertMediaRowStart(pool: Pool, args: {
  messageId: string;
  ordinal: number;
  sourceProvider: string;
  sourceProviderMessageId: string | null;
  sourceProviderMediaId: string | null;
  sourceProviderUrl: string | null;
  sourceMimeType: string | null;
  sourceFileName: string | null;
  sourceSizeBytes: number | null;
  sourceDurationSeconds: number | null;
  mediaType: string;
  displayMimeType: string | null;
  displayFileName: string | null;
  displaySizeBytes: number | null;
  displayDurationSeconds: number | null;
  width: number | null;
  height: number | null;
  metadataJson: Record<string, unknown>;
}): Promise<string> {
  const existing = args.sourceProviderMediaId
    ? await pool.query(
        `SELECT id FROM pendencias.crm_message_media WHERE message_id = $1::uuid AND source_provider_media_id = $2 LIMIT 1`,
        [args.messageId, args.sourceProviderMediaId]
      )
    : { rows: [] as any[] };
  if (existing.rows?.[0]?.id) {
    const id = String(existing.rows[0].id);
    await pool.query(
      `
        UPDATE pendencias.crm_message_media
        SET
          processing_status = 'DOWNLOADING',
          processing_error = NULL,
          source_provider_url = COALESCE($2, source_provider_url),
          source_mime_type = COALESCE($3, source_mime_type),
          metadata_json = metadata_json || $4::jsonb
        WHERE id = $1::uuid
      `,
      [id, args.sourceProviderUrl, args.sourceMimeType, JSON.stringify(args.metadataJson)]
    );
    return id;
  }
  const ins = await pool.query(
    `
      INSERT INTO pendencias.crm_message_media (
        message_id, ordinal, source_provider, source_provider_message_id, source_provider_media_id,
        source_provider_url, source_mime_type, source_file_name, source_size_bytes, source_duration_seconds,
        processing_status, media_type, display_mime_type, display_file_name, display_size_bytes,
        display_duration_seconds, width, height, metadata_json
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        'DOWNLOADING', $11, $12, $13, $14,
        $15, $16, $17, $18::jsonb
      )
      RETURNING id
    `,
    [
      args.messageId,
      args.ordinal,
      args.sourceProvider,
      args.sourceProviderMessageId,
      args.sourceProviderMediaId,
      args.sourceProviderUrl,
      args.sourceMimeType,
      args.sourceFileName,
      args.sourceSizeBytes,
      args.sourceDurationSeconds,
      args.mediaType,
      args.displayMimeType,
      args.displayFileName,
      args.displaySizeBytes,
      args.displayDurationSeconds,
      args.width,
      args.height,
      JSON.stringify(args.metadataJson),
    ]
  );
  return String(ins.rows[0].id);
}

async function finalizeMediaStored(
  pool: Pool,
  args: {
    rowId: string;
    fileId: string;
    displayMimeType: string;
    displayFileName: string;
    displaySizeBytes: number;
    displayDurationSeconds: number | null;
    width: number | null;
    height: number | null;
    metadataPatch: Record<string, unknown>;
  }
) {
  await pool.query(
    `
      UPDATE pendencias.crm_message_media
      SET
        stored_file_id = $2::uuid,
        processing_status = 'STORED',
        processing_error = NULL,
        stored_at = NOW(),
        display_mime_type = $3,
        display_file_name = $4,
        display_size_bytes = $5,
        display_duration_seconds = $6,
        width = $7,
        height = $8,
        metadata_json = metadata_json || $9::jsonb
      WHERE id = $1::uuid
    `,
    [
      args.rowId,
      args.fileId,
      args.displayMimeType,
      args.displayFileName,
      args.displaySizeBytes,
      args.displayDurationSeconds,
      args.width,
      args.height,
      JSON.stringify(args.metadataPatch),
    ]
  );
}

async function finalizeMediaFailed(pool: Pool, rowId: string, err: string) {
  await pool.query(
    `
      UPDATE pendencias.crm_message_media
      SET processing_status = 'FAILED', processing_error = $2
      WHERE id = $1::uuid
    `,
    [rowId, err.slice(0, 2000)]
  );
}

export async function ingestMetaInboundMedia(args: {
  pool: Pool;
  messageId: string;
  conversationId: string;
  waMessage: any;
  accessToken: string;
  providerMessageId: string | null;
}): Promise<void> {
  const settings = await getCrmMediaSettings(args.pool);
  const msg = args.waMessage;
  const type = String(msg?.type || "");
  if (!type || type === "text" || type === "interactive" || type === "button") return;

  const block = msg?.[type] || {};
  const mediaId = String(block?.id || "").trim();
  if (!mediaId) return;

  const mediaType = mapWaTypeToMediaType(type);
  const ordinal = 0;
  const sourceUrl: string | null = null;
  const caption = block?.caption ? String(block.caption) : null;

  let rowId: string;
  try {
    rowId = await upsertMediaRowStart(args.pool, {
      messageId: args.messageId,
      ordinal,
      sourceProvider: "META",
      sourceProviderMessageId: args.providerMessageId,
      sourceProviderMediaId: mediaId,
      sourceProviderUrl: sourceUrl,
      sourceMimeType: block?.mime_type ? String(block.mime_type) : null,
      sourceFileName: block?.filename ? String(block.filename) : null,
      sourceSizeBytes: block?.file_size != null ? Number(block.file_size) : null,
      sourceDurationSeconds: block?.duration != null ? Number(block.duration) : null,
      mediaType,
      displayMimeType: block?.mime_type ? String(block.mime_type) : null,
      displayFileName: block?.filename ? String(block.filename) : null,
      displaySizeBytes: block?.file_size != null ? Number(block.file_size) : null,
      displayDurationSeconds: block?.duration != null ? Number(block.duration) : null,
      width: block?.width != null ? Number(block.width) : null,
      height: block?.height != null ? Number(block.height) : null,
      metadataJson: { wa_type: type, caption: caption || undefined, sha256: block?.sha256 || undefined },
    });
  } catch (e: any) {
    console.error("[crm-media] meta_row_start", { messageId: args.messageId, err: String(e?.message || e) });
    return;
  }

  try {
    const downloaded = await downloadMetaMedia(args.accessToken, mediaId);
    let buffer = downloaded.buffer;
    let mime = downloaded.mimeType;
    let fname = block?.filename ? String(block.filename) : downloaded.suggestedName;

    const maxB = maxUploadBytesForMediaType(settings, mediaType);
    if (buffer.length > maxB) {
      await finalizeMediaFailed(args.pool, rowId, `arquivo_acima_do_limite_${maxB}`);
      return;
    }
    if (!isMimeAllowedForMediaType(settings, mediaType, mime)) {
      await finalizeMediaFailed(args.pool, rowId, `mime_nao_permitido_${mime}`);
      return;
    }

    if (mediaType === "audio") {
      const tr = await maybeTranscodeInboundAudio({
        buffer,
        mimeType: mime,
        baseFileName: fname,
        settings,
      });
      if (!tr.ok) {
        await finalizeMediaFailed(args.pool, rowId, tr.reason);
        return;
      }
      buffer = tr.buffer;
      mime = tr.mimeType;
      fname = tr.fileName;
    }

    const now = new Date();
    const fileRow = await uploadFileToSharePoint({
      pool: args.pool,
      module: "crm",
      entity: "whatsapp_media",
      entityId: args.messageId,
      originalName: fname,
      mimeType: mime,
      buffer,
      uploadedBy: "whatsapp-meta-webhook",
      pathContext: {
        year: String(now.getFullYear()),
        month: pad2(now.getMonth() + 1),
        conversation_id: args.conversationId,
        media_type: mediaType,
        provider_slug: "meta",
      },
    });

    await finalizeMediaStored(args.pool, {
      rowId,
      fileId: fileRow.id,
      displayMimeType: mime,
      displayFileName: fname,
      displaySizeBytes: buffer.length,
      displayDurationSeconds: block?.duration != null ? Number(block.duration) : null,
      width: block?.width != null ? Number(block.width) : null,
      height: block?.height != null ? Number(block.height) : null,
      metadataPatch: { ingest: "meta_download_ok", transcode: mediaType === "audio" },
    });
    console.info("[crm-media] meta_stored", { messageId: args.messageId, fileId: fileRow.id, mediaType });
  } catch (e: any) {
    console.warn("[crm-media] meta_failed", { messageId: args.messageId, err: String(e?.message || e) });
    await finalizeMediaFailed(args.pool, rowId, String(e?.message || e));
  }
}

export async function ingestEvolutionInboundMedia(args: {
  pool: Pool;
  messageId: string;
  conversationId: string;
  evolutionItem: any;
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  providerMessageId: string | null;
}): Promise<void> {
  const settings = await getCrmMediaSettings(args.pool);
  const evolutionItemPrepared = mergeDeepMediaIntoEvolutionItem(args.evolutionItem) as typeof args.evolutionItem;
  const inner =
    evolutionItemPrepared?.message || evolutionItemPrepared?.msg || evolutionItemPrepared;
  const fid = String(args.providerMessageId || args.messageId);
  const realSlots = collectEvolutionMediaSlots(inner, fid);
  let slots = realSlots.length ? realSlots : inferKeyOnlyEvolutionMediaSlots(evolutionItemPrepared, fid);
  if (!slots.length) return;
  const keyOnlySlots = realSlots.length === 0 && slots.length > 0;

  console.info("[crm-media] evolution_detected", {
    messageId: args.messageId,
    providerMessageId: args.providerMessageId,
    instanceName: args.instanceName,
    slotCount: slots.length,
    realSlotCount: realSlots.length,
    keyOnlySlots,
    deepProtoHints: extractEvolutionIngestibleMediaProtoHints(evolutionItemPrepared).slice(0, 12),
  });
  if (crmEvolutionMediaDebugEnabled()) {
    console.info("[crm-media] evolution_detected_detail", {
      messageId: args.messageId,
      slotsPreview: slots.slice(0, 4).map((s) => ({ mediaType: s.mediaType, fileName: s.fileName })),
    });
  }

  const key = evolutionItemPrepared?.key || {};
  const remoteJid = String(key.remoteJid || (evolutionItemPrepared as any)?.remoteJid || "").trim();

  let ordinal = 0;
  for (const slot of slots) {
    const effProto = effectiveEvolutionProtoKeyForGetBase64({
      slot,
      evolutionItem: evolutionItemPrepared,
    });
    const remappedToSticker = effProto === "stickerMessage";
    const effMediaType = remappedToSticker ? "sticker" : slot.mediaType;
    const displayNameForRow =
      remappedToSticker &&
      (!slot.fileName || /\.(jpe?g|png)$/i.test(String(slot.fileName || "")))
        ? "sticker.webp"
        : slot.fileName;

    const rowId = await upsertMediaRowStart(args.pool, {
      messageId: args.messageId,
      ordinal: ordinal++,
      sourceProvider: "EVOLUTION",
      sourceProviderMessageId: args.providerMessageId,
      sourceProviderMediaId: slot.providerMediaKey,
      sourceProviderUrl: null,
      sourceMimeType: slot.mimeType,
      sourceFileName: displayNameForRow,
      sourceSizeBytes: null,
      sourceDurationSeconds: slot.seconds,
      mediaType: effMediaType,
      displayMimeType: slot.mimeType,
      displayFileName: displayNameForRow,
      displaySizeBytes: null,
      displayDurationSeconds: slot.seconds,
      width: slot.width,
      height: slot.height,
      metadataJson: { ingest: "evolution_slot", instance: args.instanceName },
    });

    if (crmEvolutionMediaDebugEnabled()) {
      console.info("[crm-media] evolution_db_inserted", {
        messageId: args.messageId,
        rowId,
        ordinal: ordinal - 1,
        protoKey: effProto,
        mediaType: effMediaType,
      });
    }

    try {
      if (!remoteJid) {
        await finalizeMediaFailed(args.pool, rowId, "reachability:evolution_sem_remote_jid");
        continue;
      }

      const messageForApi = {
        key: {
          remoteJid,
          fromMe: key.fromMe === true,
          id: key.id || args.providerMessageId,
        },
        message: { [effProto]: slot.mediaBlock },
      };

      if (crmEvolutionMediaDebugEnabled()) {
        console.info("[crm-media] evolution_download_start", {
          messageId: args.messageId,
          rowId,
          effProto,
          slotProto: slot.protoKey,
          remoteJid: remoteJid.slice(0, 32),
          instanceName: args.instanceName,
        });
      }

      const b64 = await evolutionGetBase64FromMediaMessage({
        serverUrl: args.serverUrl,
        apiKey: args.apiKey,
        instanceName: args.instanceName,
        message: messageForApi,
      });
      if (!b64?.buffer?.length) {
        const errShort = String(b64?.error || "evolution_sem_base64").slice(0, 400);
        console.warn("[crm-media] evolution_download_failed", {
          messageId: args.messageId,
          rowId,
          err: errShort,
          effProto,
        });
        if (crmEvolutionMediaDebugEnabled()) {
          console.warn("[crm-media] evolution_download_failed_detail", {
            messageId: args.messageId,
            rowId,
            keyOnlySlots,
            remoteJid: remoteJid.slice(0, 40),
          });
        }
        await finalizeMediaFailed(args.pool, rowId, `reachability:${b64?.error || "evolution_sem_base64"}`);
        continue;
      }
      let buffer = b64.buffer;
      const mimeResolved = resolveEvolutionMime({
        mimeFromBase64: b64.mimeType,
        mimeFromSlot: slot.mimeType,
        fileName: slot.fileName,
        buffer,
        mediaType: effMediaType,
      });
      let mime = mimeResolved.mime;
      let fname =
        remappedToSticker &&
        (!slot.fileName || /\.(jpe?g|png)$/i.test(String(slot.fileName || "")))
          ? "sticker.webp"
          : slot.fileName || `evo_${slot.providerMediaKey}.${extFromMime(mime)}`;

      const maxB = maxUploadBytesForMediaType(settings, effMediaType);
      if (buffer.length > maxB) {
        await finalizeMediaFailed(args.pool, rowId, `size:arquivo_acima_do_limite_${maxB}`);
        continue;
      }
      if (!isMimeAllowedForMediaType(settings, effMediaType, mime)) {
        await finalizeMediaFailed(args.pool, rowId, `mime:mime_nao_permitido_${mime}`);
        continue;
      }

      if (effMediaType === "audio") {
        const tr = await maybeTranscodeInboundAudio({
          buffer,
          mimeType: mime,
          baseFileName: fname,
          settings,
        });
        if (!tr.ok) {
          await finalizeMediaFailed(args.pool, rowId, `parse:${tr.reason}`);
          continue;
        }
        buffer = tr.buffer;
        mime = tr.mimeType;
        fname = tr.fileName;
      }

      const now = new Date();
      const fileRow = await uploadFileToSharePoint({
        pool: args.pool,
        module: "crm",
        entity: "whatsapp_media",
        entityId: args.messageId,
        originalName: fname,
        mimeType: mime,
        buffer,
        uploadedBy: "whatsapp-evolution-webhook",
        pathContext: {
          year: String(now.getFullYear()),
          month: pad2(now.getMonth() + 1),
          conversation_id: args.conversationId,
          media_type: effMediaType,
          provider_slug: "evolution",
        },
      });

      await finalizeMediaStored(args.pool, {
        rowId,
        fileId: fileRow.id,
        displayMimeType: mime,
        displayFileName: fname,
        displaySizeBytes: buffer.length,
        displayDurationSeconds: slot.seconds,
        width: slot.width,
        height: slot.height,
        metadataPatch: {
          ingest: "evolution_base64_ok",
          mime_source: mimeResolved.source,
          ...(effProto !== slot.protoKey ? { evolution_proto_remapped: { from: slot.protoKey, to: effProto } } : {}),
        },
      });
      console.info("[crm-media] evolution_stored", {
        messageId: args.messageId,
        fileId: fileRow.id,
        mediaType: effMediaType,
      });
    } catch (e: any) {
      console.warn("[crm-media] evolution_failed", { messageId: args.messageId, err: String(e?.message || e) });
      await finalizeMediaFailed(args.pool, rowId, `parse:${String(e?.message || e)}`);
    }
  }
}

/** Mensagens enviadas pelo CRM com arquivo já no catálogo (upload dedicado). */
export async function recordCrmOutboundMediaFromStoredFiles(
  pool: Pool,
  args: {
    messageId: string;
    conversationId: string;
    files: Array<{
      fileId: string;
      mediaType?: string | null;
      mimeType: string;
      fileName: string;
      sizeBytes: number;
    }>;
  }
): Promise<void> {
  let ord = 0;
  for (const f of args.files) {
    const mediaType = inferMediaCategoryFromMimeOrHint(f.mimeType, f.mediaType);
    try {
      await pool.query(
        `
          INSERT INTO pendencias.crm_message_media (
            message_id, ordinal, source_provider, source_provider_message_id, source_provider_media_id,
            source_provider_url, source_mime_type, source_file_name, source_size_bytes,
            stored_file_id, processing_status, stored_at,
            media_type, display_mime_type, display_file_name, display_size_bytes,
            metadata_json
          )
          VALUES (
            $1::uuid, $2, 'CRM', NULL, $3,
            NULL, $4, $5, $6,
            $7::uuid, 'STORED', NOW(),
            $8, $4, $5, $6,
            $9::jsonb
          )
          ON CONFLICT (message_id, source_provider_media_id)
          WHERE source_provider_media_id IS NOT NULL AND btrim(source_provider_media_id) <> ''
          DO NOTHING
        `,
        [
          args.messageId,
          ord++,
          f.fileId,
          f.mimeType,
          f.fileName,
          f.sizeBytes,
          f.fileId,
          mediaType,
          JSON.stringify({ outbound: true, conversation_id: args.conversationId }),
        ]
      );
    } catch (e: any) {
      console.warn("[crm-media] outbound_record_skip", String(e?.message || e));
    }
  }
}
