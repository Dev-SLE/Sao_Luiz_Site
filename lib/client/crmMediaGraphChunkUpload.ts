/**
 * Upload resumível para `uploadUrl` devolvido pelo Microsoft Graph (`createUploadSession`).
 * Não envia o corpo pela Vercel — só pedidos pequenos ao nosso backend para obter a sessão e para finalizar o catálogo.
 */
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

/** Fragmentos de 4 MiB (recomendação Graph / margem segura em browsers). */
const DEFAULT_CHUNK = 4 * 1024 * 1024;

export async function uploadFileToGraphUploadSession(uploadUrl: string, file: File, chunkSize = DEFAULT_CHUNK): Promise<{ id: string; name?: string; size?: number }> {
  const total = file.size;
  if (total <= 0) throw new Error("Ficheiro vazio");
  let start = 0;
  let lastBody: Record<string, unknown> | null = null;
  while (start < total) {
    const end = Math.min(start + chunkSize, total) - 1;
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
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = {};
    }
    if (res.status === 200 || res.status === 201) {
      const id = String(json.id || "").trim();
      if (id) {
        return {
          id,
          name: json.name != null ? String(json.name) : undefined,
          size: json.size != null ? Number(json.size) : undefined,
        };
      }
      if (lastBody && String(lastBody.id || "").trim()) {
        const id2 = String(lastBody.id).trim();
        return {
          id: id2,
          name: lastBody.name != null ? String(lastBody.name) : undefined,
          size: lastBody.size != null ? Number(lastBody.size) : undefined,
        };
      }
    }
    if (res.status === 202) {
      const nr = json.nextExpectedRanges as string[] | undefined;
      start = parseNextRangeStart(nr, end + 1);
      lastBody = json;
      continue;
    }
    throw new Error(`Upload Graph falhou (${res.status}): ${text.slice(0, 280)}`);
  }
  throw new Error("Upload Graph terminou sem item final");
}
