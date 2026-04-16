/** URLs servidas pela API de arquivos (SharePoint via backend). */
export function isApiFilesViewUrl(url: string): boolean {
  const u = String(url || "").trim();
  return /^\/?api\/files\/[^/]+\/view\/?$/i.test(u) || (u.includes("/api/files/") && u.includes("/view"));
}

export function toAbsoluteMediaUrl(url: string): string {
  const u = String(url || "").trim();
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (typeof window !== "undefined") {
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${window.location.origin}${path}`;
  }
  return u;
}
