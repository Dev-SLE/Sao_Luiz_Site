import { google, type drive_v3 } from "googleapis";

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI não configurados");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getDriveFolderId() {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("DRIVE_FOLDER_ID não configurado");
  return folderId;
}

/** Pasta mãe "PROCESSOS" no Drive; se ausente, usa a mesma de DRIVE_FOLDER_ID. */
export function getProcessosParentFolderId() {
  const p = process.env.DRIVE_PROCESSOS_FOLDER_ID?.trim();
  if (p) return p;
  return getDriveFolderId();
}

const safeDriveNamePart = (s: string) => String(s || "").replace(/[^\w\-./]+/g, "_").slice(0, 80);

/**
 * Garante subpasta nomeada como CTE_x_SER_y dentro da pasta PROCESSOS.
 */
export async function ensureDriveCaseFolder(drive: drive_v3.Drive, cte: string, serie: string): Promise<string> {
  const parentId = getProcessosParentFolderId();
  const name = `CTE_${safeDriveNamePart(cte)}_SER_${safeDriveNamePart(serie || "0")}`;
  const esc = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `'${parentId}' in parents and name = '${esc}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 5,
  });
  const hit = list.data.files?.find((f) => f.name === name);
  if (hit?.id) return hit.id;
  const created = (await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  } as any)) as { data: { id?: string | null } };
  const id = created.data.id;
  if (!id) throw new Error("Drive não criou pasta do processo");
  return id;
}

