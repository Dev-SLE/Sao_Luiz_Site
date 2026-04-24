/**
 * Upload resumível para `uploadUrl` devolvido pelo Microsoft Graph (`createUploadSession`).
 * Não envia o corpo pela Vercel — só pedidos pequenos ao nosso backend para obter a sessão e para finalizar o catálogo.
 */

/** Graph permite até 60 MiB por fragmento; margem para não falhar no limite. */
const GRAPH_SINGLE_PUT_MAX_BYTES = 58 * 1024 * 1024;

/** Fragmentos de 4 MiB (recomendação Graph / margem segura em browsers). */
const DEFAULT_CHUNK = 4 * 1024 * 1024;

function stripBom(text: string): string {
  return String(text || "").replace(/^\uFEFF/, "");
}

function safeJsonParse(text: string): Record<string, unknown> {
  const t = stripBom(text).trim();
  if (!t) return {};
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseNextRangeStart(nextRanges: string[] | undefined, fallback: number): number {
  const r = nextRanges?.[0];
  if (!r || typeof r !== "string") return fallback;
  const t = r.trim();
  const mDash = /^(\d+)-$/.exec(t);
  if (mDash) return parseInt(mDash[1], 10);
  const mRange = /^(\d+)-(\d+)$/.exec(t);
  if (mRange) return parseInt(mRange[2], 10) + 1;
  const mSingle = /^(\d+)$/.exec(t);
  if (mSingle) return parseInt(mSingle[1], 10);
  return fallback;
}

function extractGraphDriveItemId(json: Record<string, unknown>): string {
  const top = String(json.id || "").trim();
  if (top) return top;
  const item = json.item;
  if (item && typeof item === "object") {
    const id = String((item as Record<string, unknown>).id || "").trim();
    if (id) return id;
  }
  const val = json.value;
  if (val && typeof val === "object") {
    const id = String((val as Record<string, unknown>).id || "").trim();
    if (id) return id;
  }
  const rd = json.resourceData;
  if (rd && typeof rd === "object") {
    const id = String((rd as Record<string, unknown>).id || "").trim();
    if (id) return id;
  }
  return "";
}

async function graphPutRange(
  uploadUrl: string,
  file: File,
  start: number,
  end: number,
  total: number
): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const blob = file.slice(start, end + 1);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
    body: blob,
  });
  const text = await res.text();
  const json = safeJsonParse(text);
  return { status: res.status, text, json };
}

/** Alguns tenants ODSP respondem 202 sem `id` quando o último byte já foi enviado; GET ao uploadUrl pode devolver metadados. */
async function tryResolveIdViaUploadSessionGet(uploadUrl: string): Promise<{ id: string; name?: string; size?: number } | null> {
  try {
    const res = await fetch(uploadUrl, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    const json = safeJsonParse(text);
    const id = extractGraphDriveItemId(json);
    if (!id) return null;
    return {
      id,
      name: json.name != null ? String(json.name) : undefined,
      size: json.size != null ? Number(json.size) : undefined,
    };
  } catch {
    return null;
  }
}

function driveItemFromJson(json: Record<string, unknown>): { id: string; name?: string; size?: number } | null {
  const id = extractGraphDriveItemId(json);
  if (!id) return null;
  return {
    id,
    name: json.name != null ? String(json.name) : undefined,
    size: json.size != null ? Number(json.size) : undefined,
  };
}

export async function uploadFileToGraphUploadSession(
  uploadUrl: string,
  file: File,
  chunkSize = DEFAULT_CHUNK
): Promise<{ id: string; name?: string; size?: number }> {
  const total = file.size;
  if (total <= 0) throw new Error("Ficheiro vazio");

  const effectiveChunk = Math.min(Math.max(chunkSize || DEFAULT_CHUNK, 256 * 1024), DEFAULT_CHUNK);

  /**
   * Um único PUT com o ficheiro completo (até 58 MiB) evita bugs em que vários 202 seguidos
   * fazem `nextStart` saltar para `total` sem nunca vir 200/201 com `id` (comum em vídeos curtos > 3 MiB).
   */
  if (total <= GRAPH_SINGLE_PUT_MAX_BYTES) {
    const { status, text, json } = await graphPutRange(uploadUrl, file, 0, total - 1, total);
    const ok = driveItemFromJson(json);
    if (ok && [200, 201, 202, 204].includes(status)) return ok;
    const viaGet = await tryResolveIdViaUploadSessionGet(uploadUrl);
    if (viaGet) return viaGet;
    throw new Error(`Upload Graph (monolítico) falhou (${status}): ${text.slice(0, 280)}`);
  }

  let start = 0;
  let lastBody: Record<string, unknown> | null = null;
  while (start < total) {
    const end = Math.min(start + effectiveChunk, total) - 1;
    const { status, text, json } = await graphPutRange(uploadUrl, file, start, end, total);
    const sentLastByte = end === total - 1;

    if (status === 200 || status === 201 || status === 204) {
      const ok = driveItemFromJson(json);
      if (ok) return ok;
      if (lastBody) {
        const fromPrev = driveItemFromJson(lastBody);
        if (fromPrev) return fromPrev;
      }
      if (sentLastByte) {
        const viaGet = await tryResolveIdViaUploadSessionGet(uploadUrl);
        if (viaGet) return viaGet;
      }
    }

    if (status === 202) {
      const from202 = driveItemFromJson(json);
      if (from202) return from202;

      const nr = json.nextExpectedRanges as string[] | undefined;
      let nextStart = parseNextRangeStart(nr, end + 1);
      if (nextStart <= start) {
        nextStart = end + 1;
      }

      const noMissingRanges = !nr || nr.length === 0;
      const serverSaysPastEnd = nextStart >= total;

      if (sentLastByte && (noMissingRanges || serverSaysPastEnd)) {
        const viaGet = await tryResolveIdViaUploadSessionGet(uploadUrl);
        if (viaGet) return viaGet;
        const late = driveItemFromJson(json);
        if (late) return late;
      }

      start = nextStart;
      lastBody = json;

      if (start >= total && sentLastByte) {
        const viaGet = await tryResolveIdViaUploadSessionGet(uploadUrl);
        if (viaGet) return viaGet;
        const fromLast = lastBody ? driveItemFromJson(lastBody) : null;
        if (fromLast) return fromLast;
      }
      continue;
    }

    throw new Error(`Upload Graph falhou (${status}): ${text.slice(0, 280)}`);
  }

  if (lastBody) {
    const fromLast = driveItemFromJson(lastBody);
    if (fromLast) return fromLast;
  }
  const viaGet = await tryResolveIdViaUploadSessionGet(uploadUrl);
  if (viaGet) return viaGet;

  throw new Error("Upload Graph terminou sem item final");
}
