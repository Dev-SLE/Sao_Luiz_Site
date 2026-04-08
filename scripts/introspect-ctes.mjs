import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const sql = `
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_schema = 'pendencias' AND table_name = 'ctes'
  ORDER BY ordinal_position
`;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query(sql);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
