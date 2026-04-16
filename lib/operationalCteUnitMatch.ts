/**
 * Espelha a regra de escopo do servidor (destino, origem, emissão sem entrega).
 * Usado no DataTable quando a paginação/filtros são aplicados no cliente.
 */
export function operationalCteRowMatchesProfileUnits(
  row: { ENTREGA?: string; COLETA?: string; STATUS?: string; IS_HISTORICAL?: boolean },
  dest?: string | null,
  origin?: string | null
): boolean {
  const d = String(dest || "").trim();
  const o = String(origin || "").trim();
  if (!d && !o) return true;
  const ent = String(row.ENTREGA || "").trim();
  const col = String(row.COLETA || "").trim();
  const st = String(row.STATUS || "").toUpperCase();
  const emiss = st.includes("EMISS") || st.includes("AUTORIZ");
  if (d && ent === d) return true;
  if (o && col === o) return true;
  if (o && emiss && ent === "" && col === o) return true;
  if (row.IS_HISTORICAL && ent === "ARQUIVO") return true;
  return false;
}
