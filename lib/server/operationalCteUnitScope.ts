/**
 * Escopo de unidade para CT-e no operacional (usuário sem scope.operacional.all):
 * destino (entrega), origem (coleta) ou CT-e "em emissão" sem entrega preenchida ainda,
 * desde que a coleta bata com a unidade de origem do perfil.
 */
export const OPERATIONAL_CTE_STATUS_NORM_SQL = `
  TRANSLATE(UPPER(COALESCE(c.status, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
`;

/** Gera `AND (...)` com placeholders $paramDest e $paramOrigin (índices do pg). */
export function operationalCteUnitScopeAndClause(paramDest: number, paramOrigin: number): string {
  const N = OPERATIONAL_CTE_STATUS_NORM_SQL.replace(/\s+/g, " ").trim();
  return `
    AND (
      (
        ($${paramDest}::text IS NULL OR TRIM($${paramDest}::text) = '')
        AND ($${paramOrigin}::text IS NULL OR TRIM($${paramOrigin}::text) = '')
      )
      OR (
        ($${paramDest}::text IS NOT NULL AND TRIM($${paramDest}::text) <> '' AND TRIM(COALESCE(c.entrega::text,'')) = TRIM($${paramDest}::text))
        OR ($${paramOrigin}::text IS NOT NULL AND TRIM($${paramOrigin}::text) <> '' AND TRIM(COALESCE(c.coleta::text,'')) = TRIM($${paramOrigin}::text))
        OR (
          ($${paramOrigin}::text IS NOT NULL AND TRIM($${paramOrigin}::text) <> '')
          AND (${N} LIKE '%EMISS%' OR ${N} LIKE '%AUTORIZ%')
          AND TRIM(COALESCE(c.entrega::text,'')) = ''
          AND TRIM(COALESCE(c.coleta::text,'')) = TRIM($${paramOrigin}::text)
        )
      )
    )
  `;
}
