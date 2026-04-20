/**
 * Introspecção do schema analítico `bi` no banco de COMERCIAL_DATABASE_URL.
 * Consulta o catálogo do Postgres (information_schema) com cache para validar views/colunas
 * usadas pelas rotas de BI de Comissões.
 */
import type { Pool } from "pg";

export type BiViewColumn = {
  name: string;
  dataType: string;
};

export type BiSchemaCatalog = {
  schema: string;
  /** Nome da relação sem schema (ex.: vw_comissoes_ranking). */
  views: Record<string, { columns: BiViewColumn[] }>;
  /** Tabelas/views esperadas sem linhas em information_schema.columns (inexistentes ou sem acesso). */
  missingTables: string[];
  fetchedAtMs: number;
};

let cache: { catalog: BiSchemaCatalog; expiresAt: number; tablesKey: string } | null = null;

function schemaCacheTtlMs(): number {
  const raw = String(process.env.BI_COMISSOES_SCHEMA_CACHE_TTL_MS ?? "").trim();
  if (raw === "0") return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(3_600_000, n);
  return 120_000;
}

function introspectEveryRequest(): boolean {
  return String(process.env.BI_COMISSOES_SCHEMA_INTROSPECT_EVERY_REQUEST ?? "").trim() === "1";
}

function isTemporalDataType(dataType: string): boolean {
  const d = dataType.toLowerCase();
  return d === "date" || d.startsWith("timestamp");
}

/**
 * Resolve coluna usada em `col::date` para filtro de período.
 * - `env`: coluna explícita existe na view.
 * - `inferred`: primeira coluna date/timestamp na ordem do catálogo.
 */
export function resolveDateColumnForSql(
  columns: BiViewColumn[],
  envColumn: string | null,
): { column: string | null; source: "env" | "inferred" | "none" } {
  if (!columns.length) return { column: null, source: "none" };
  const byLower = new Map(columns.map((c) => [c.name.toLowerCase(), c.name] as const));
  if (envColumn) {
    const hit = byLower.get(envColumn.toLowerCase());
    if (hit) return { column: hit, source: "env" };
  }
  const first = columns.find((c) => isTemporalDataType(c.dataType));
  return first ? { column: first.name, source: "inferred" } : { column: null, source: "none" };
}

/**
 * Carrega colunas de `information_schema.columns` para as relações pedidas no schema `bi`.
 */
export async function fetchBiComissoesSchemaCatalog(
  pool: Pool,
  schema: string,
  tableNames: string[],
): Promise<BiSchemaCatalog> {
  const uniq = [...new Set(tableNames.map((t) => t.trim()).filter(Boolean))];
  if (!uniq.length) {
    return { schema, views: {}, missingTables: [], fetchedAtMs: Date.now() };
  }

  const res = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    ordinal_position: number;
  }>(
    `
      SELECT table_name, column_name, data_type, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = ANY($2::text[])
      ORDER BY table_name, ordinal_position
    `,
    [schema, uniq],
  );

  const views: Record<string, { columns: BiViewColumn[] }> = {};
  for (const row of res.rows || []) {
    const tn = String(row.table_name);
    if (!views[tn]) views[tn] = { columns: [] };
    views[tn].columns.push({
      name: String(row.column_name),
      dataType: String(row.data_type),
    });
  }

  const missingTables = uniq.filter((t) => !views[t]?.columns?.length);

  return {
    schema,
    views,
    missingTables,
    fetchedAtMs: Date.now(),
  };
}

export async function getBiComissoesSchemaCatalog(
  pool: Pool,
  schema: string,
  tableNames: string[],
  forceRefresh?: boolean,
): Promise<BiSchemaCatalog> {
  const tablesKey = `${schema}:${[...new Set(tableNames)].sort().join(",")}`;
  const now = Date.now();
  const ttl = schemaCacheTtlMs();
  const bust = forceRefresh || introspectEveryRequest();

  if (
    !bust &&
    cache &&
    cache.tablesKey === tablesKey &&
    cache.expiresAt > now
  ) {
    return cache.catalog;
  }

  const catalog = await fetchBiComissoesSchemaCatalog(pool, schema, tableNames);
  const expiresAt = ttl === 0 ? now : now + ttl;
  cache = { catalog, expiresAt, tablesKey };
  return catalog;
}

export function invalidateBiComissoesSchemaCache() {
  cache = null;
}
