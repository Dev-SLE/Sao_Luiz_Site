import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function getPool() {
  if (!global.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não configurado");
    }
    global.__pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return global.__pgPool;
}

