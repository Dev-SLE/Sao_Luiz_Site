import type { Pool } from "pg";
import { ensureCrmSchemaTables } from "./ensureSchema";

export type CrmMediaSettings = {
  maxInlineVideoBytes: number;
  maxUploadImageMb: number;
  maxUploadAudioMb: number;
  maxUploadVideoMb: number;
  maxUploadDocumentMb: number;
  allowedMimeByMediaType: Record<string, string[]>;
  maxRecordedAudioSeconds: number;
  videoExternalFallbackPolicy: string;
  targetAudioMime: string;
  targetAudioCodec: string;
  forceTranscodeAudio: boolean;
  allowWavFallback: boolean;
};

const DEFAULT_ALLOWED: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  audio: ["audio/ogg", "audio/opus", "audio/mpeg", "audio/mp4", "audio/webm", "audio/aac", "audio/amr", "audio/wav"],
  video: [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/3gpp",
    "video/x-matroska",
    "video/matroska",
    "video/avi",
    "video/x-msvideo",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  sticker: ["image/webp", "image/png"],
  unknown: [],
};

function normalizeMimeList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
}

/** Parte principal do MIME, sem parâmetros (ex.: `audio/webm;codecs=opus` → `audio/webm`). */
export function mimeBaseType(mime: string): string {
  return String(mime || "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    .trim();
}

function mergeAllowed(db: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = { ...DEFAULT_ALLOWED };
  for (const [k, list] of Object.entries(db || {})) {
    const key = String(k).toLowerCase();
    const merged = normalizeMimeList(list);
    if (!merged.length) continue;
    const defaults = DEFAULT_ALLOWED[key];
    // União com defaults: listas na BD não podem remover tipos base (ex.: audio/webm do gravador).
    if (defaults?.length) {
      out[key] = [...new Set([...defaults, ...merged])];
    } else {
      out[key] = merged;
    }
  }
  return out;
}

export async function getCrmMediaSettings(pool: Pool): Promise<CrmMediaSettings> {
  await ensureCrmSchemaTables();
  const res = await pool.query(
    `
      SELECT
        max_inline_video_bytes,
        max_upload_image_mb,
        max_upload_audio_mb,
        max_upload_video_mb,
        max_upload_document_mb,
        allowed_mime_by_media_type,
        max_recorded_audio_seconds,
        video_external_fallback_policy,
        target_audio_mime,
        target_audio_codec,
        force_transcode_audio,
        allow_wav_fallback
      FROM pendencias.crm_media_settings
      WHERE id = 1
      LIMIT 1
    `
  );
  const row = res.rows?.[0];
  const rawAllowed = row?.allowed_mime_by_media_type;
  const parsed =
    rawAllowed && typeof rawAllowed === "object" && !Array.isArray(rawAllowed)
      ? (rawAllowed as Record<string, unknown>)
      : {};
  const allowed: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(parsed)) {
    allowed[k.toLowerCase()] = normalizeMimeList(v);
  }

  return {
    maxInlineVideoBytes: Math.max(0, Number(row?.max_inline_video_bytes ?? 20 * 1024 * 1024)),
    maxUploadImageMb: Math.max(1, Number(row?.max_upload_image_mb ?? 25)),
    maxUploadAudioMb: Math.max(1, Number(row?.max_upload_audio_mb ?? 25)),
    maxUploadVideoMb: Math.max(1, Number(row?.max_upload_video_mb ?? 100)),
    maxUploadDocumentMb: Math.max(1, Number(row?.max_upload_document_mb ?? 50)),
    allowedMimeByMediaType: mergeAllowed(allowed),
    maxRecordedAudioSeconds: Math.max(5, Number(row?.max_recorded_audio_seconds ?? 120)),
    videoExternalFallbackPolicy: String(row?.video_external_fallback_policy || "INLINE_IF_UNDER_LIMIT"),
    targetAudioMime: String(row?.target_audio_mime || "audio/ogg"),
    targetAudioCodec: String(row?.target_audio_codec || "opus"),
    forceTranscodeAudio: row?.force_transcode_audio === true,
    allowWavFallback: row?.allow_wav_fallback === true,
  };
}

export function maxUploadBytesForMediaType(settings: CrmMediaSettings, mediaType: string): number {
  const t = String(mediaType || "unknown").toLowerCase();
  const mb =
    t === "image"
      ? settings.maxUploadImageMb
      : t === "audio"
        ? settings.maxUploadAudioMb
        : t === "video"
          ? settings.maxUploadVideoMb
          : t === "document"
            ? settings.maxUploadDocumentMb
            : Math.max(settings.maxUploadDocumentMb, settings.maxUploadVideoMb);
  return mb * 1024 * 1024;
}

export function isMimeAllowedForMediaType(settings: CrmMediaSettings, mediaType: string, mime: string): boolean {
  const t = String(mediaType || "unknown").toLowerCase();
  const base = mimeBaseType(mime);
  if (!base) return false;
  const list = settings.allowedMimeByMediaType[t];
  if (!list || list.length === 0) return true;
  return list.some((entry) => mimeBaseType(entry) === base);
}

export function inlineVideoAllowedFromSettings(
  settings: CrmMediaSettings,
  mediaType: string,
  sizeBytes: number | null | undefined
): boolean {
  if (String(mediaType || "").toLowerCase() !== "video") return true;
  if (String(settings.videoExternalFallbackPolicy || "").toUpperCase() === "ALWAYS_CARD") return false;
  const n = Number(sizeBytes || 0);
  if (!n) return true;
  return n <= settings.maxInlineVideoBytes;
}
