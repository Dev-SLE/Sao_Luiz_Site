import { uploadFileToGraphUploadSession } from "@/lib/client/crmMediaGraphChunkUpload";

/** Abaixo disto o POST multipart `/api/crm/media/upload` costuma caber no limite de corpo das funções Vercel (~4,5 MiB). */
export const CRM_MEDIA_VERCEL_DIRECT_MAX_BYTES = 3 * 1024 * 1024;

export type CrmMediaUploadResult = {
  fileId: string;
  mimeType: string;
  fileName: string;
  mediaType: string;
  viewUrl?: string;
  downloadUrl?: string;
};

function mediaHintFromFile(file: File): string {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return "document";
}

/**
 * Envia anexo CRM para SharePoint: multipart curto ou sessão Graph (ficheiros grandes).
 */
export async function uploadCrmWhatsappMediaAttachment(args: {
  file: File;
  conversationId: string;
}): Promise<CrmMediaUploadResult> {
  const { file, conversationId } = args;
  const hint = mediaHintFromFile(file);

  if (file.size <= CRM_MEDIA_VERCEL_DIRECT_MAX_BYTES) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("conversationId", conversationId);
    fd.append("mediaType", hint);
    const up = await fetch("/api/crm/media/upload", { method: "POST", body: fd });
    const upJson = (await up.json().catch(() => ({}))) as Record<string, unknown>;
    if (!up.ok || !upJson?.fileId) {
      const errMsg = typeof upJson?.error === "string" ? upJson.error : `HTTP ${up.status}`;
      throw new Error(errMsg);
    }
    return {
      fileId: String(upJson.fileId),
      mimeType: String(upJson.mimeType || file.type || "application/octet-stream"),
      fileName: file.name,
      mediaType: String(upJson.mediaType || hint),
      viewUrl: upJson.viewUrl ? String(upJson.viewUrl) : undefined,
      downloadUrl: upJson.downloadUrl ? String(upJson.downloadUrl) : undefined,
    };
  }

  const start = await fetch("/api/crm/media/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      expectedSizeBytes: file.size,
      mediaType: hint,
    }),
  });
  const sj = (await start.json().catch(() => ({}))) as Record<string, unknown>;
  if (!start.ok || !sj?.uploadUrl || !sj?.sessionToken) {
    throw new Error(typeof sj?.error === "string" ? sj.error : `HTTP ${start.status}`);
  }

  const chunk = typeof sj.chunkBytes === "number" && sj.chunkBytes > 0 ? sj.chunkBytes : undefined;
  const graphItem = await uploadFileToGraphUploadSession(String(sj.uploadUrl), file, chunk);

  const done = await fetch("/api/crm/media/upload-session/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: String(sj.sessionToken),
      itemId: graphItem.id,
    }),
  });
  const dj = (await done.json().catch(() => ({}))) as Record<string, unknown>;
  if (!done.ok || !dj?.fileId) {
    throw new Error(typeof dj?.error === "string" ? dj.error : `HTTP ${done.status}`);
  }

  return {
    fileId: String(dj.fileId),
    mimeType: String(dj.mimeType || file.type || "application/octet-stream"),
    fileName: String(dj.fileName || file.name),
    mediaType: String(dj.mediaType || hint),
    viewUrl: dj.viewUrl ? String(dj.viewUrl) : undefined,
    downloadUrl: dj.downloadUrl ? String(dj.downloadUrl) : undefined,
  };
}
