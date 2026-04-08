import { AGENCY_STOPS } from "./data/agencyStops";
import { normalizeDestination } from "./maps/destinos";

/**
 * Extrai token principal de strings tipo "DEC - JATAI" / "DEC - MACEIO / ...".
 */
export function extractLocationToken(raw: string | null | undefined): string {
  const s = String(raw || "")
    .trim()
    .split("/")[0]
    .trim();
  if (!s) return "";
  const parts = s.split("-").map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];
  return s;
}

/**
 * Tenta casar texto de coleta/entrega com uma chave de parada conhecida.
 */
export function matchAgencyStopKey(raw: string | null | undefined): string | null {
  const token = extractLocationToken(raw);
  if (!token) return null;
  const n = normalizeDestination(token);
  if (!n) return null;
  for (const stop of AGENCY_STOPS) {
    if (n === stop.key) return stop.key;
  }
  for (const stop of AGENCY_STOPS) {
    if (n.includes(stop.key) || stop.key.includes(n)) return stop.key;
  }
  return null;
}
