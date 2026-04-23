/**
 * Sufixo numérico para título do lead / UI (não confundir com phone_last10 de merge).
 * Em BR com DDI 55 e ≥12 dígitos, usa os últimos 11 (DDD + celular) para não “cortar” o 11.
 */
export function crmPhoneSuffixForTitle(fullDigits: string): string {
  const d = String(fullDigits || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) {
    return d.slice(-11);
  }
  if (d.length === 11) return d;
  if (d.length > 11) return d.slice(-11);
  if (d.length >= 10) return d.slice(-10);
  return d;
}

/** Remove sufixo " (apenas dígitos)" no final do título. */
export function crmStripTrailingTitlePhone(title: string): string {
  return String(title || "").replace(/\s*\(\d{8,16}\)\s*$/, "").trim();
}
