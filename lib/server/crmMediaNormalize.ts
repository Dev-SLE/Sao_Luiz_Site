import { randomBytes } from "crypto";

/** String útil para nome MIME ou ficheiro — rejeita não-string e artefacto `String({})`. */
export function safeMediaString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  if (t === "[object Object]" || /^\[object\s+object\]$/i.test(t)) return null;
  return t;
}

export function filenameLooksCorrupt(name: string): boolean {
  const s = String(name || "").trim();
  if (!s) return true;
  if (/object\s*object/i.test(s)) return true;
  if (s === "[object Object]") return true;
  return false;
}

/** Segmento seguro para chaves e sufixos de `evo_*` (SharePoint / URLs). */
export function sanitizeKeySegment(raw: string, maxLen = 96): string {
  const s = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+|\.+$/g, "");
  if (!s || filenameLooksCorrupt(s)) return "x";
  return s.slice(0, maxLen);
}

export function mediaExtFromMime(mime: string): string {
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

function hashLikeToHexSnippet(v: unknown, max = 64): string | null {
  if (v == null) return null;
  try {
    if (Buffer.isBuffer(v)) return v.toString("hex").slice(0, max);
    if (v instanceof Uint8Array) return Buffer.from(v).toString("hex").slice(0, max);
  } catch {
    /* ignore */
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "[object Object]") return null;
    if (/^[0-9a-fA-F]{16,256}$/i.test(t)) return t.slice(0, max).toLowerCase();
    if (t.length >= 8 && t.length <= 128 && !/[\u0100-\uffff]/.test(t)) {
      try {
        return Buffer.from(t, "latin1").toString("hex").slice(0, max);
      } catch {
        /* ignore */
      }
    }
  }
  if (typeof v === "object") return null;
  return null;
}

/**
 * Identificador estável para `source_provider_media_id` e sufixo de nome —
 * nunca usa `String(object)` (origem de `evo_[object Object].jpg`).
 */
export function evolutionBlockStableId(
  block: Record<string, unknown>,
  role: "img" | "vid" | "ptv" | "ptt" | "aud" | "doc",
  fallbackMsgId: string,
  ordinal: number
): string {
  const h = hashLikeToHexSnippet(block.fileEncSha256) || hashLikeToHexSnippet(block.fileSha256);
  if (h) return `${role}_${h}`;
  const fid = sanitizeKeySegment(String(fallbackMsgId || "x"), 48);
  return `${role}_${fid}_${ordinal}`;
}

/** Nome seguro para upload Evolution → SharePoint (original sanitizado ou `evo_*`). */
export function buildSafeEvolutionUploadFileName(args: {
  safeOriginalFileName: string | null;
  providerMediaKey: string;
  mime: string;
  /** ex.: sticker.webp quando remapeado */
  forcedDisplayName?: string | null;
}): string {
  const forced = safeMediaString(args.forcedDisplayName);
  if (forced) return sanitizeFilenameForDisplay(forced, args.mime);

  const ext = mediaExtFromMime(args.mime);
  const orig = args.safeOriginalFileName;
  if (orig && !filenameLooksCorrupt(orig)) {
    const s = sanitizeFilenameForDisplay(orig, args.mime);
    if (s.length >= 2 && /\.[a-z0-9]{2,12}$/i.test(s)) return s;
  }
  const stamp = `${Date.now()}_${randomBytes(4).toString("hex")}`;
  const pk = sanitizeKeySegment(args.providerMediaKey, 64);
  return `evo_${stamp}_${pk}.${ext}`;
}

/** Remove caracteres problemáticos para nome de ficheiro amigável (não é o nome físico no drive). */
export function sanitizeFilenameForDisplay(name: string, mime: string): string {
  let s = String(name || "").trim();
  s = s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ");
  if (!s || filenameLooksCorrupt(s)) {
    return `evo_${Date.now()}.${mediaExtFromMime(mime)}`;
  }
  if (!/\.[a-z0-9]{2,12}$/i.test(s)) {
    s = `${s}.${mediaExtFromMime(mime)}`;
  }
  return s.slice(0, 200);
}

/** Rótulo para UI / API: esconde nomes corruptos herdados. */
export function displayFilenameForAttachment(
  displayFileName: string | null | undefined,
  mediaType: string | null | undefined,
  mimeType: string | null | undefined
): string | null {
  const raw = displayFileName != null ? String(displayFileName) : "";
  if (raw && !filenameLooksCorrupt(raw)) return raw;
  const mt = String(mediaType || "").toLowerCase();
  const mime = String(mimeType || "");
  if (mt.includes("image")) return "Imagem";
  if (mt.includes("video")) return "Vídeo";
  if (mt.includes("audio")) return "Áudio";
  if (mt.includes("document")) return "Documento";
  if (mt.includes("sticker")) return "Figurinha";
  if (mime.startsWith("image/")) return "Imagem";
  if (mime.startsWith("video/")) return "Vídeo";
  if (mime.startsWith("audio/")) return "Áudio";
  return "Ficheiro";
}

export type CrmInboundMediaNormalized = {
  tipo: string;
  storage_provider: "sharepoint";
  storage_path: string | null;
  file_catalog_id: string | null;
  nome_arquivo: string;
  nome_original: string | null;
  mime_type: string;
  extensao: string;
  tamanho_bytes: number;
};
