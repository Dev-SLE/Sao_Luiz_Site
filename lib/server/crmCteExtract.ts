/** Extrai candidato a número de CTE de texto livre (mensagem cliente, rascunho IA, etc.). */
export function extractCteFromText(text: string): string | null {
  const raw = String(text || "");
  if (/^\s*\d{3,12}\s*$/.test(raw)) return raw.trim();
  const longDigits = raw.match(/\b\d{5,}\b/);
  if (longDigits) return longDigits[0];
  const cteHint = raw.match(/\bcte\b[^0-9]{0,10}(\d{3,12})\b/i);
  if (cteHint?.[1]) return cteHint[1];
  return null;
}
