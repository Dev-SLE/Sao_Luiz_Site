/** Formatacao numerica/moeda compartilhada do Comercial 360 (UI). */

export function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function formatBrl(n: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Valores em tabelas detalhadas (drill): sempre duas casas decimais. */
export function formatBrlDetail(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}
