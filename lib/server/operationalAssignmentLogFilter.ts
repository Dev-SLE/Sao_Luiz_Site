/**
 * Visibilidade de logs de atribuição: só quem atribuiu (`username`) ou o atribuído
 * (`assignedUsername` / `previousAssignedUsername` no payload) vê o evento.
 * @param usernameParamIndex índice do parâmetro SQL do utilizador da sessão (1-based).
 */
export function operationalAssignmentLogsVisibilitySql(usernameParamIndex: number): string {
  const p = `$${usernameParamIndex}`;
  return `
    AND (
      (event = 'CTE_ASSIGNMENT_UPSERT' AND (
        LOWER(TRIM(COALESCE(username, ''))) = LOWER(TRIM(${p}::text))
        OR LOWER(TRIM(COALESCE(payload->>'assignedUsername', ''))) = LOWER(TRIM(${p}::text))
      ))
      OR (event = 'CTE_ASSIGNMENT_CLEAR' AND (
        LOWER(TRIM(COALESCE(username, ''))) = LOWER(TRIM(${p}::text))
        OR LOWER(TRIM(COALESCE(payload->>'previousAssignedUsername', ''))) = LOWER(TRIM(${p}::text))
      ))
    )
  `;
}
