/** Fuso padrão da operação (exibe igual em dev local e em servidores UTC como Vercel). */
export const APP_TIMEZONE = "America/Sao_Paulo";

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value || "00";
}

/**
 * Formata instante em `dd/mm/aaaa HH:mm:ss` no horário de Brasília.
 */
export function formatDateTime(date: any): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    return `${part(parts, "day")}/${part(parts, "month")}/${part(parts, "year")} ${part(parts, "hour")}:${part(parts, "minute")}:${part(parts, "second")}`;
  } catch {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }
}

/**
 * Data civil `dd/mm/aaaa` para colunas `DATE` do Postgres (não aplicar fuso: evita 07 virar 06).
 * Para instantes com hora relevante, use `formatDateTime`.
 */
export function formatDateOnlyBr(date: any): string {
  if (!date) return "";
  if (typeof date === "string") {
    const t = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const [y, m, d] = t.split("-");
      return `${d}/${m}/${y}`;
    }
  }
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
