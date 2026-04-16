/** Indica se o MIME é de vídeo (reprodução no elemento de vídeo do HTML). */
export function isVideoMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return /^video\//i.test(String(mime).trim());
}
