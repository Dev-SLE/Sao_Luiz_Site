/**
 * Compara `evolution_server_url` das inboxes EVOLUTION no Neon com a base esperada.
 *
 * Uso:
 *   node scripts/check-evolution-inbox-urls.mjs
 *
 * Variáveis:
 *   DATABASE_URL (obrigatório)
 *   EVOLUTION_EXPECTED_BASE_URL (opcional; senão usa EVOLUTION_API_URL)
 *
 * Exit code 1 se houver inboxes com URL normalizada diferente da esperada.
 */
import pg from "pg";

function normalizeBase(raw) {
  let s = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.toLowerCase();
}

async function main() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error("DATABASE_URL não definido.");
    process.exit(1);
  }
  const expectedRaw =
    process.env.EVOLUTION_EXPECTED_BASE_URL?.trim() ||
    process.env.EVOLUTION_API_URL?.trim() ||
    "";
  const expected = normalizeBase(expectedRaw);
  if (!expected) {
    console.error("Defina EVOLUTION_EXPECTED_BASE_URL ou EVOLUTION_API_URL para comparar.");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  try {
    const { rows } = await pool.query(
      `SELECT id, name, evolution_instance_name, evolution_server_url, evolution_api_key IS NOT NULL AS has_key
       FROM pendencias.crm_whatsapp_inboxes
       WHERE provider = 'EVOLUTION'
       ORDER BY name`
    );

    console.log(JSON.stringify({ expectedBase: expected, inboxCount: rows.length }, null, 2));

    let mismatches = 0;
    for (const r of rows) {
      const got = normalizeBase(r.evolution_server_url || "");
      const ok = got === expected;
      if (!ok) mismatches++;
      console.log(
        JSON.stringify({
          id: r.id,
          name: r.name,
          instance: r.evolution_instance_name,
          hasKey: r.has_key,
          serverUrl: r.evolution_server_url,
          normalized: got || null,
          matchesExpected: ok,
        })
      );
    }

    if (rows.length === 0) {
      console.warn("Nenhuma inbox EVOLUTION no Neon — crie uma no CRM após a limpeza.");
    }
    if (mismatches > 0) {
      console.error(`\n${mismatches} inbox(es) com URL diferente da esperada. Atualize evolution_server_url ou alinhe a env.`);
      process.exit(1);
    }
    console.log("OK: todas as inboxes EVOLUTION têm a mesma base URL que a env esperada.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
