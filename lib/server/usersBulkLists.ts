import { BI_COMISSOES_CONFIG } from "@/modules/bi/comissoes/config";
import { getPool } from "./db";

export type UsersBulkTemplateLists = {
  profiles: string[];
  units: string[];
  vendedoras: string[];
};

export async function fetchUsersBulkTemplateLists(): Promise<UsersBulkTemplateLists> {
  const pool = getPool();
  const [profilesRes, unitsRes] = await Promise.all([
    pool.query(`SELECT name::text AS name FROM pendencias.profiles ORDER BY name ASC`),
    pool.query(`
      SELECT DISTINCT TRIM(x) AS unit FROM (
        SELECT coleta::text AS x FROM pendencias.ctes
        WHERE coleta IS NOT NULL AND TRIM(coleta::text) <> ''
        UNION
        SELECT entrega::text AS x FROM pendencias.ctes
        WHERE entrega IS NOT NULL AND TRIM(entrega::text) <> ''
      ) u
      WHERE TRIM(x) <> ''
      ORDER BY 1
    `),
  ]);

  const profiles = (profilesRes.rows || []).map((r: { name?: string }) => String(r.name || "").trim()).filter(Boolean);
  const units = (unitsRes.rows || []).map((r: { unit?: string }) => String(r.unit || "").trim()).filter(Boolean);
  const vendedoras = [...BI_COMISSOES_CONFIG.vendedorFinalAllowlist].map((v) => String(v));

  return { profiles, units, vendedoras };
}
