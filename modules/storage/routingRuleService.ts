import type { Pool } from "pg";
import type { StorageRuleRow } from "./types";

export async function fetchActiveRule(
  pool: Pool,
  module: string,
  entity: string,
  provider: string
): Promise<StorageRuleRow | null> {
  const r = await pool.query(
    `
    SELECT id, module, entity, provider, site_name, library_name, sharepoint_site_id, sharepoint_drive_id,
           path_template, allowed_extensions, max_file_size_mb, visibility_scope, is_active
    FROM pendencias.storage_rules
    WHERE module = $1 AND is_active = true AND provider = $2
      AND (entity = $3 OR entity = '*')
    ORDER BY CASE WHEN entity = $3 THEN 0 ELSE 1 END, entity DESC
    LIMIT 1
  `,
    [module, provider, entity]
  );
  const row = r.rows?.[0];
  if (!row) return null;
  return row as StorageRuleRow;
}
