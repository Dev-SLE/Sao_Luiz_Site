import type { Pool } from "pg";

const LEGACY_TAB = "tab.gerencial.setor.financeiro.view";
const MODULE_KEY = "module.financeiro.view";

function parseProfilePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map(String);
    } catch {
      /* fall through */
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

let backfillStarted = false;

/**
 * Perfis que só tinham a aba legada do setor Financeiro passam a incluir `module.financeiro.view`
 * (hub Gerencial /app/gerencial/financeiro). Idempotente.
 *
 * Chamado em pontos pouco frequentes (login, GET perfis) com guard em memória por instância Node.
 */
export async function maybeBackfillFinanceiroModulePermission(pool: Pool): Promise<void> {
  if (backfillStarted) return;
  backfillStarted = true;
  try {
    const col = await pool.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'pendencias'
        AND table_name = 'profiles'
        AND column_name = 'permissions'
    `);
    const dt = String(col.rows?.[0]?.data_type || "").toLowerCase();
    const udt = String(col.rows?.[0]?.udt_name || "").toLowerCase();
    if (!dt && !udt) return;
    const useJsonb = dt === "jsonb" || dt === "json" || udt === "jsonb";

    const res = await pool.query(`SELECT name, permissions FROM pendencias.profiles`);
    for (const row of res.rows || []) {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      const perms = parseProfilePermissions(row?.permissions);
      if (!perms.includes(LEGACY_TAB) || perms.includes(MODULE_KEY)) continue;
      const next = [...perms, MODULE_KEY];
      if (useJsonb) {
        await pool.query(
          `UPDATE pendencias.profiles SET permissions = $2::jsonb, updated_at = NOW() WHERE name = $1`,
          [name, JSON.stringify(next)]
        );
      } else {
        await pool.query(
          `UPDATE pendencias.profiles SET permissions = $2::text[], updated_at = NOW() WHERE name = $1`,
          [name, next]
        );
      }
    }
  } catch (e) {
    console.warn("[profile-backfill] financeiro module.financeiro.view:", e);
    backfillStarted = false;
  }
}
