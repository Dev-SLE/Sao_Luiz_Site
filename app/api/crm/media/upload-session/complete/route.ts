import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureCrmSchemaTables } from "@/lib/server/ensureSchema";
import { can, getSessionContext } from "@/lib/server/authorization";
import { getDriveItem } from "@/lib/server/sharepointGraph";
import { insertSharePointFileFromDriveItem } from "@/modules/storage/fileService";
import { verifyCrmMediaUploadSessionPayload } from "@/lib/server/crmMediaUploadSessionToken";
import { fetchActiveRule } from "@/modules/storage/routingRuleService";
import { renderPathTemplate } from "@/modules/storage/pathTemplate";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const session = await getSessionContext(req);
    if (!session || !can(session, "crm.messages.send")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionToken = String(body?.sessionToken || "").trim();
    const itemId = String(body?.itemId || "").trim();
    if (!sessionToken || !itemId) {
      return NextResponse.json({ error: "sessionToken e itemId são obrigatórios" }, { status: 400 });
    }

    const payload = verifyCrmMediaUploadSessionPayload(sessionToken);
    if (!payload) {
      return NextResponse.json({ error: "Sessão de upload inválida ou expirada" }, { status: 400 });
    }

    const username = String(session.username || "crm").trim() || "crm";
    if (payload.username !== username) {
      return NextResponse.json({ error: "Sessão não pertence a este utilizador" }, { status: 403 });
    }

    const item = await getDriveItem(payload.siteId, payload.driveId, itemId);
    if (!item?.id) {
      return NextResponse.json({ error: "Item não encontrado no SharePoint" }, { status: 400 });
    }
    const parentId = String(item.parentReference?.id || "").trim();
    if (parentId && parentId !== payload.folderItemId) {
      return NextResponse.json({ error: "Item não está na pasta esperada" }, { status: 400 });
    }
    const sizeOnGraph = item.size != null ? Number(item.size) : null;
    if (sizeOnGraph != null && sizeOnGraph !== payload.expectedSize) {
      return NextResponse.json(
        { error: `Tamanho no OneDrive (${sizeOnGraph}) não coincide com o anunciado (${payload.expectedSize})` },
        { status: 400 }
      );
    }

    const pool = getPool();
    const rule = await fetchActiveRule(pool, "crm", "whatsapp_media", "sharepoint");
    if (!rule) {
      return NextResponse.json({ error: "Regra de storage SharePoint indisponível" }, { status: 500 });
    }

    const now = new Date();
    const relativeFolder =
      payload.relativeFolder ||
      renderPathTemplate(rule.path_template, {
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1).padStart(2, "0"),
        conversation_id: payload.conversationId,
        media_type: payload.mediaCat,
        provider_slug: "crm",
      });

    const fileRow = await insertSharePointFileFromDriveItem({
      pool,
      module: "crm",
      entity: "whatsapp_media",
      entityId: payload.entityId,
      originalName: payload.originalName,
      mimeType: payload.mimeType,
      fileSizeBytes: sizeOnGraph ?? payload.expectedSize,
      uploadedBy: username,
      rule,
      driveRef: { siteId: payload.siteId, driveId: payload.driveId },
      item,
      relativeFolder,
      expectedStoredFileName: payload.storedFileName,
      extension: payload.extension,
      uploadSession: true,
    });

    return NextResponse.json({
      success: true,
      fileId: fileRow.id,
      mimeType: payload.mimeType,
      fileName: payload.originalName,
      sizeBytes: sizeOnGraph ?? payload.expectedSize,
      mediaType: payload.mediaCat,
      viewUrl: `/api/files/${fileRow.id}/view`,
      downloadUrl: `/api/files/${fileRow.id}/download`,
    });
  } catch (e: any) {
    console.error("[crm/media/upload-session/complete]", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
