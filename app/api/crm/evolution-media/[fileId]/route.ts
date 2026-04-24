import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPool } from "@/lib/server/db";
import { getFileById, recordFileAccess } from "@/modules/storage/fileService";
import { getItemContentResponse } from "@/lib/server/sharepointGraph";

export const runtime = "nodejs";

const MAX_SKEW_MS = 60_000;
const MAX_AGE_MS = 15 * 60 * 1000;

function verifyEvolutionMediaSig(fileId: string, t: string, s: string): boolean {
  const secret = String(process.env.FILES_EVOLUTION_DOWNLOAD_SECRET || "").trim();
  if (!secret || !fileId || !t || !s) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${fileId}:${t}`).digest("hex");
  if (expected.length !== s.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(s, "utf8"));
  } catch {
    return false;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    const u = new URL(_req.url);
    const t = u.searchParams.get("t") || "";
    const s = u.searchParams.get("s") || "";
    if (!verifyEvolutionMediaSig(fileId, t, s)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const ts = Number(t);
    if (!Number.isFinite(ts)) return new NextResponse("Bad request", { status: 400 });
    const now = Date.now();
    if (ts > now + MAX_SKEW_MS || now - ts > MAX_AGE_MS) {
      return new NextResponse("Expired", { status: 401 });
    }

    const pool = getPool();
    const file = await getFileById(pool, fileId);
    if (!file) return new NextResponse("Not found", { status: 404 });
    if (!file.sharepoint_item_id || !file.sharepoint_site_id || !file.sharepoint_drive_id) {
      return new NextResponse("Gone", { status: 410 });
    }

    const res = await getItemContentResponse(
      file.sharepoint_site_id,
      file.sharepoint_drive_id,
      file.sharepoint_item_id
    );
    if (!res.ok) {
      return new NextResponse("Bad gateway", { status: 502 });
    }
    const ct = file.mime_type || res.headers.get("content-type") || "application/octet-stream";
    await recordFileAccess(pool, file.id, "evolution_media_fetch", null);
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name || file.file_name)}"`,
      },
    });
  } catch (e) {
    console.error("[crm.evolution-media]", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}
