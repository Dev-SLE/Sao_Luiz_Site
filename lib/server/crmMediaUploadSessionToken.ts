import crypto from "crypto";

export type CrmMediaUploadSessionPayloadV1 = {
  v: 1;
  siteId: string;
  driveId: string;
  folderItemId: string;
  storedFileName: string;
  extension: string;
  originalName: string;
  mimeType: string;
  conversationId: string;
  username: string;
  mediaCat: string;
  entityId: string;
  /** Pasta relativa no drive (mesma lógica do `path_template` no momento da sessão). */
  relativeFolder: string;
  expectedSize: number;
  exp: number;
};

function sessionSecret(): string {
  const s =
    process.env.CRM_MEDIA_UPLOAD_SESSION_SECRET?.trim() ||
    process.env.FILES_EVOLUTION_DOWNLOAD_SECRET?.trim() ||
    "";
  if (s.length < 16) {
    throw new Error(
      "Defina CRM_MEDIA_UPLOAD_SESSION_SECRET (recomendado) ou FILES_EVOLUTION_DOWNLOAD_SECRET (min. 16 chars) para upload grande ao SharePoint."
    );
  }
  return s;
}

export function signCrmMediaUploadSessionPayload(p: CrmMediaUploadSessionPayloadV1): string {
  const data = Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
  return `${data}.${mac}`;
}

export function verifyCrmMediaUploadSessionPayload(token: string): CrmMediaUploadSessionPayloadV1 | null {
  try {
    const last = token.lastIndexOf(".");
    if (last <= 0) return null;
    const data = token.slice(0, last);
    const mac = token.slice(last + 1);
    const expect = crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
    const a = Buffer.from(mac, "utf8");
    const b = Buffer.from(expect, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as CrmMediaUploadSessionPayloadV1;
    if (p.v !== 1 || typeof p.exp !== "number") return null;
    if (p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
