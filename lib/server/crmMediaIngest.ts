import type { Pool } from "pg";
import { uploadFileToSharePoint } from "@/modules/storage/fileService";
import { evolutionGetBase64FromMediaMessage } from "@/lib/server/evolutionClient";
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
  const h = String(hint || "").toLowerCase();
  if (["image", "audio", "video", "document", "sticker"].includes(h)) return h;
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
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

function unwrapEvolutionInner(msg: any): any {
  if (!msg || typeof msg !== "object") return msg;
  if (msg.message && typeof msg.message === "object") return unwrapEvolutionInner(msg.message);
  if (msg.ephemeralMessage?.message) return unwrapEvolutionInner(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapEvolutionInner(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapEvolutionInner(msg.viewOnceMessageV2.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapEvolutionInner(msg.documentWithCaptionMessage.message);
  if (msg.editedMessage?.message) return unwrapEvolutionInner(msg.editedMessage.message);
  return msg;
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
  push("audio", "audioMessage", m.audioMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : null,
    fileName: b.ptt ? "voice.opus" : "audio.bin",
    seconds: numOrNull(b.seconds),
    w: null,
    h: null,
    key: String(b.fileEncSha256 || b.fileSha256 || `aud_${fallbackMsgId}_${idx++}`),
  }));
  push("audio", "pttMessage", m.pttMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : null,
    fileName: "voice.ptt",
    seconds: numOrNull(b.seconds),
    w: null,
    h: null,
    key: String(b.fileEncSha256 || b.fileSha256 || `ptt_${fallbackMsgId}_${idx++}`),
  }));
  push("document", "documentMessage", m.documentMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : null,
    fileName: b.fileName ? String(b.fileName) : null,
    seconds: null,
    w: null,
    h: null,
    key: String(b.fileEncSha256 || b.fileSha256 || `doc_${fallbackMsgId}_${idx++}`),
  }));
  push("sticker", "stickerMessage", m.stickerMessage, (b) => ({
    mime: b.mimetype ? String(b.mimetype) : "image/webp",
    fileName: "sticker.webp",
    seconds: null,
    w: numOrNull(b.width),
    h: numOrNull(b.height),
    key: String(b.fileEncSha256 || b.fileSha256 || `stk_${fallbackMsgId}_${idx++}`),
  }));

  return out;
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
  const inner = args.evolutionItem?.message || args.evolutionItem?.msg || args.evolutionItem;
  const slots = collectEvolutionMediaSlots(inner, String(args.providerMessageId || args.messageId));
  if (!slots.length) return;

  const key = args.evolutionItem?.key || {};

  let ordinal = 0;
  for (const slot of slots) {
    const rowId = await upsertMediaRowStart(args.pool, {
      messageId: args.messageId,
      ordinal: ordinal++,
      sourceProvider: "EVOLUTION",
      sourceProviderMessageId: args.providerMessageId,
      sourceProviderMediaId: slot.providerMediaKey,
      sourceProviderUrl: null,
      sourceMimeType: slot.mimeType,
      sourceFileName: slot.fileName,
      sourceSizeBytes: null,
      sourceDurationSeconds: slot.seconds,
      mediaType: slot.mediaType,
      displayMimeType: slot.mimeType,
      displayFileName: slot.fileName,
      displaySizeBytes: null,
      displayDurationSeconds: slot.seconds,
      width: slot.width,
      height: slot.height,
      metadataJson: { ingest: "evolution_slot", instance: args.instanceName },
    });

    try {
      const messageForApi = {
        key: {
          remoteJid: key.remoteJid,
          fromMe: key.fromMe === true,
          id: key.id || args.providerMessageId,
        },
        message: { [slot.protoKey]: slot.mediaBlock },
      };

      const b64 = await evolutionGetBase64FromMediaMessage({
        serverUrl: args.serverUrl,
        apiKey: args.apiKey,
        instanceName: args.instanceName,
        message: messageForApi,
      });
      if (!b64?.buffer?.length) {
        await finalizeMediaFailed(args.pool, rowId, b64?.error || "evolution_sem_base64");
        continue;
      }
      let buffer = b64.buffer;
      let mime = b64.mimeType || slot.mimeType || "application/octet-stream";
      let fname = slot.fileName || `evo_${slot.providerMediaKey}.${extFromMime(mime)}`;

      const maxB = maxUploadBytesForMediaType(settings, slot.mediaType);
      if (buffer.length > maxB) {
        await finalizeMediaFailed(args.pool, rowId, `arquivo_acima_do_limite_${maxB}`);
        continue;
      }
      if (!isMimeAllowedForMediaType(settings, slot.mediaType, mime)) {
        await finalizeMediaFailed(args.pool, rowId, `mime_nao_permitido_${mime}`);
        continue;
      }

      if (slot.mediaType === "audio") {
        const tr = await maybeTranscodeInboundAudio({
          buffer,
          mimeType: mime,
          baseFileName: fname,
          settings,
        });
        if (!tr.ok) {
          await finalizeMediaFailed(args.pool, rowId, tr.reason);
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
          media_type: slot.mediaType,
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
        metadataPatch: { ingest: "evolution_base64_ok" },
      });
      console.info("[crm-media] evolution_stored", { messageId: args.messageId, fileId: fileRow.id, mediaType: slot.mediaType });
    } catch (e: any) {
      console.warn("[crm-media] evolution_failed", { messageId: args.messageId, err: String(e?.message || e) });
      await finalizeMediaFailed(args.pool, rowId, String(e?.message || e));
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
