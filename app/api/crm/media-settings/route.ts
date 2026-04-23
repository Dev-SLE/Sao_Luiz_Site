import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { ensureCrmSchemaTables } from "@/lib/server/ensureSchema";
import { getCrmMediaSettings } from "@/lib/server/crmMediaSettings";
import { can, getSessionContext } from "@/lib/server/authorization";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const session = await getSessionContext(req);
    if (!session || !can(session, "tab.crm.chat.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const pool = getPool();
    const s = await getCrmMediaSettings(pool);
    return NextResponse.json({
      maxInlineVideoBytes: s.maxInlineVideoBytes,
      maxUploadImageMb: s.maxUploadImageMb,
      maxUploadAudioMb: s.maxUploadAudioMb,
      maxUploadVideoMb: s.maxUploadVideoMb,
      maxUploadDocumentMb: s.maxUploadDocumentMb,
      allowedMimeByMediaType: s.allowedMimeByMediaType,
      maxRecordedAudioSeconds: s.maxRecordedAudioSeconds,
      videoExternalFallbackPolicy: s.videoExternalFallbackPolicy,
      targetAudioMime: s.targetAudioMime,
      targetAudioCodec: s.targetAudioCodec,
    });
  } catch (e) {
    console.error("[crm/media-settings]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
