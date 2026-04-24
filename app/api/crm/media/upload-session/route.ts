import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureCrmSchemaTables } from "@/lib/server/ensureSchema";
import { can, getSessionContext } from "@/lib/server/authorization";
import { createDriveItemUploadSession } from "@/lib/server/sharepointGraph";
import { prepareSharePointCrmUpload } from "@/modules/storage/fileService";
import { getCrmMediaSettings, isMimeAllowedForMediaType, maxUploadBytesForMediaType } from "@/lib/server/crmMediaSettings";
import { inferMediaCategoryFromMimeOrHint } from "@/lib/server/crmMediaIngest";
import { signCrmMediaUploadSessionPayload } from "@/lib/server/crmMediaUploadSessionToken";

export const runtime = "nodejs";

const CHUNK_BYTES = 4 * 1024 * 1024;

function inferMimeFromName(fileName: string, fallback: string): string {
  let mime = String(fallback || "").trim() || "application/octet-stream";
  if (mime === "application/octet-stream" || !mime) {
    const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
    const byExt: Record<string, string> = {
      webm: "audio/webm",
      ogg: "audio/ogg",
      opus: "audio/ogg",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mov: "video/quicktime",
      pdf: "application/pdf",
    };
    if (byExt[ext]) mime = byExt[ext];
  }
  return mime;
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const session = await getSessionContext(req);
    if (!session || !can(session, "crm.messages.send")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const conversationId = String(body?.conversationId || "").trim() || "pending";
    const fileName = String(body?.fileName || "").trim();
    const expectedSizeBytes = Number(body?.expectedSizeBytes);
    const mediaHint = String(body?.mediaType || "").trim() || null;
    const mimeRaw = String(body?.mimeType || "").trim();

    if (!fileName || !Number.isFinite(expectedSizeBytes) || expectedSizeBytes <= 0) {
      return NextResponse.json({ error: "fileName e expectedSizeBytes válidos são obrigatórios" }, { status: 400 });
    }

    const pool = getPool();
    const settings = await getCrmMediaSettings(pool);
    const mime = inferMimeFromName(fileName, mimeRaw);
    const mediaCat = inferMediaCategoryFromMimeOrHint(mime, mediaHint);
    const maxB = maxUploadBytesForMediaType(settings, mediaCat);
    if (expectedSizeBytes > maxB) {
      return NextResponse.json(
        { error: `Arquivo acima do limite permitido (${Math.floor(maxB / (1024 * 1024))} MB)` },
        { status: 400 }
      );
    }
    if (!isMimeAllowedForMediaType(settings, mediaCat, mime)) {
      return NextResponse.json({ error: "Tipo de arquivo (MIME) não permitido para este módulo" }, { status: 400 });
    }

    const username = String(session.username || "crm").trim() || "crm";
    const now = Date.now();
    const entityId = `${conversationId}:${username}:${now}`;
    const pathContext = {
      year: String(new Date().getFullYear()),
      month: String(new Date().getMonth() + 1).padStart(2, "0"),
      conversation_id: conversationId,
      media_type: mediaCat,
      provider_slug: "crm",
    };

    const prep = await prepareSharePointCrmUpload({
      pool,
      module: "crm",
      entity: "whatsapp_media",
      originalName: fileName,
      pathContext,
      expectedByteSize: expectedSizeBytes,
    });

    const { uploadUrl, expirationDateTime } = await createDriveItemUploadSession({
      siteId: prep.driveRef.siteId,
      driveId: prep.driveRef.driveId,
      folderItemId: prep.folderItemId,
      fileName: prep.storedFileName,
    });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sessionToken = signCrmMediaUploadSessionPayload({
      v: 1,
      siteId: prep.driveRef.siteId,
      driveId: prep.driveRef.driveId,
      folderItemId: prep.folderItemId,
      storedFileName: prep.storedFileName,
      extension: prep.extension,
      originalName: fileName,
      mimeType: mime,
      conversationId,
      username,
      mediaCat,
      entityId,
      relativeFolder: prep.relativeFolder,
      expectedSize: expectedSizeBytes,
      exp,
    });

    return NextResponse.json({
      success: true,
      uploadUrl,
      sessionToken,
      chunkBytes: CHUNK_BYTES,
      graphSessionExpires: expirationDateTime || null,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[crm/media/upload-session]", msg);
    if (msg.includes("CRM_MEDIA_UPLOAD_SESSION_SECRET") || msg.includes("FILES_EVOLUTION_DOWNLOAD_SECRET")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return NextResponse.json({ error: msg || "Erro interno" }, { status: 500 });
  }
}
