import { getGraphAppAccessToken } from "./graphAppToken";

const GRAPH = "https://graph.microsoft.com/v1.0";

function graphHeaders(token: string) {
  return { Authorization: `Bearer ${token}` } as Record<string, string>;
}

export type GraphDriveItem = {
  id: string;
  name: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  parentReference?: { path?: string };
  webUrl?: string;
};

function odataEscapeString(s: string) {
  return String(s).replace(/'/g, "''");
}

async function graphJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  const token = await getGraphAppAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      ...graphHeaders(token),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

/** Garante pasta filha; retorna id do item pasta. parentId 'root' usa segmento /root. */
export async function ensureChildFolder(siteId: string, driveId: string, parentId: string, folderName: string): Promise<string> {
  const safeName = folderName.replace(/[/\\]/g, "_");
  const parentSeg = parentId === "root" ? "root" : `items/${parentId}`;
  const filter = `$filter=name eq '${odataEscapeString(safeName)}'`;
  const listPath = `/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/${parentSeg}/children?${filter}`;
  const listed = await graphJson<{ value?: GraphDriveItem[] }>(listPath);
  const hit = listed.json?.value?.find((x) => x.folder && x.name === safeName);
  if (hit?.id) return hit.id;

  const createPath = `/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/${parentSeg}/children`;
  let created = await graphJson<GraphDriveItem>(createPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: safeName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });
  if (created.status === 409) {
    const again = await graphJson<{ value?: GraphDriveItem[] }>(listPath);
    const h = again.json?.value?.find((x) => x.folder && x.name === safeName);
    if (h?.id) return h.id;
  }
  if (!created.ok || !created.json?.id) {
    throw new Error(`SharePoint: falha ao criar pasta "${safeName}" (${created.status}): ${created.text?.slice(0, 400)}`);
  }
  return created.json.id;
}

/** Garante caminho relativo (sem nome de arquivo) como cadeia de pastas; retorna id da última pasta. */
export async function ensureFolderPath(siteId: string, driveId: string, relativeFolderPath: string): Promise<string> {
  const segments = relativeFolderPath
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  let parentId = "root";
  for (const seg of segments) {
    parentId = await ensureChildFolder(siteId, driveId, parentId, seg);
  }
  return parentId;
}

export async function uploadBytesToDriveFolder(params: {
  siteId: string;
  driveId: string;
  folderItemId: string;
  fileName: string;
  bytes: Buffer;
  contentType: string;
}): Promise<GraphDriveItem> {
  const { siteId, driveId, folderItemId, fileName, bytes, contentType } = params;
  const token = await getGraphAppAccessToken();
  const path = `/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${folderItemId}:/${encodeURIComponent(fileName)}:/content`;
  const res = await fetch(`${GRAPH}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: new Uint8Array(bytes),
  });
  const text = await res.text();
  let json: GraphDriveItem | null = null;
  try {
    json = text ? (JSON.parse(text) as GraphDriveItem) : null;
  } catch {
    json = null;
  }
  if (!res.ok || !json?.id) {
    throw new Error(`SharePoint: upload falhou (${res.status}): ${text?.slice(0, 400)}`);
  }
  return json;
}

export async function getDriveItem(siteId: string, driveId: string, itemId: string): Promise<GraphDriveItem | null> {
  const path = `/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,folder,file,parentReference,webUrl`;
  const r = await graphJson<GraphDriveItem>(path);
  if (!r.ok) return null;
  return r.json;
}

export async function getItemContentResponse(siteId: string, driveId: string, itemId: string): Promise<Response> {
  const token = await getGraphAppAccessToken();
  const url = `${GRAPH}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`;
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

/** URL temporária de thumbnail (Graph redireciona para CDN). */
export async function getThumbnailRequestUrl(
  siteId: string,
  driveId: string,
  itemId: string,
  size: "small" | "medium" | "large" = "medium"
): Promise<string | null> {
  const token = await getGraphAppAccessToken();
  const path = `/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
    itemId
  )}/thumbnails/0/${size}/content`;
  const url = `${GRAPH}${path}`;
  const res = await fetch(url, { method: "GET", redirect: "manual", headers: { Authorization: `Bearer ${token}` } });
  const loc = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && loc) return loc;
  if (res.ok && res.url) return res.url;
  return null;
}
