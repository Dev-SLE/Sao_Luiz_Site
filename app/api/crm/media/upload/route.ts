import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureCrmSchemaTables } from "@/lib/server/ensureSchema";
import { can, getSessionContext } from "@/lib/server/authorization";
import { uploadFileToSharePoint } from "@/modules/storage/fileService";
import { getCrmMediaSettings, isMimeAllowedForMediaType, maxUploadBytesForMediaType } from "@/lib/server/crmMediaSettings";
import { maybeTranscodeInboundAudio } from "@/lib/server/crmMediaTranscode";
import { inferMediaCategoryFromMimeOrHint } from "@/lib/server/crmMediaIngest";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const session = await getSessionContext(req);
    if (!session || !can(session, "crm.messages.send")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file");
    const conversationId = String(form.get("conversationId") || "").trim() || "pending";
    const mediaHint = String(form.get("mediaType") || "").trim() || null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }
    const f = file as File;
    const pool = getPool();
    const settings = await getCrmMediaSettings(pool);
    const mime = f.type || "application/octet-stream";
    const mediaCat = inferMediaCategoryFromMimeOrHint(mime, mediaHint);
    const maxB = maxUploadBytesForMediaType(settings, mediaCat);
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length > maxB) {
      return NextResponse.json({ error: `Arquivo acima do limite permitido (${Math.floor(maxB / (1024 * 1024))} MB)` }, { status: 400 });
    }
    if (!isMimeAllowedForMediaType(settings, mediaCat, mime)) {
      return NextResponse.json({ error: "Tipo de arquivo (MIME) não permitido para este módulo" }, { status: 400 });
    }

    let uploadBuffer = buf;
    let uploadMime = mime;
    let uploadName = f.name || "arquivo";

    if (mediaCat === "audio") {
      const tr = await maybeTranscodeInboundAudio({
        buffer: buf,
        mimeType: mime,
        baseFileName: f.name || "audio.bin",
        settings,
      });
      if (!tr.ok) {
        return NextResponse.json({ error: tr.reason || "Falha ao processar áudio" }, { status: 400 });
      }
      uploadBuffer = Buffer.from(tr.buffer);
      uploadMime = tr.mimeType;
      uploadName = tr.fileName;
    }

    const now = new Date();
    const username = String(session.username || "crm").trim() || "crm";
    const fileRow = await uploadFileToSharePoint({
      pool,
      module: "crm",
      entity: "whatsapp_media",
      entityId: `${conversationId}:${username}:${now.getTime()}`,
      originalName: uploadName,
      mimeType: uploadMime,
      buffer: Buffer.from(uploadBuffer),
      uploadedBy: username,
      pathContext: {
        year: String(now.getFullYear()),
        month: pad2(now.getMonth() + 1),
        conversation_id: conversationId,
        media_type: mediaCat,
        provider_slug: "crm",
      },
    });

    return NextResponse.json({
      success: true,
      fileId: fileRow.id,
      mimeType: uploadMime,
      fileName: uploadName,
      sizeBytes: uploadBuffer.length,
      mediaType: mediaCat,
      viewUrl: `/api/files/${fileRow.id}/view`,
      downloadUrl: `/api/files/${fileRow.id}/download`,
    });
  } catch (e: any) {
    console.error("[crm/media/upload]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
