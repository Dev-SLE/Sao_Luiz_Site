import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgPoolsByConn: Map<string, Pool> | undefined;
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

function getPoolByConnectionString(connectionString: string) {
  if (!global.__pgPoolsByConn) global.__pgPoolsByConn = new Map<string, Pool>();
  const hit = global.__pgPoolsByConn.get(connectionString);
  if (hit) return hit;
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  global.__pgPoolsByConn.set(connectionString, pool);
  return pool;
}

export function getCommercialPool() {
  const connectionString = process.env.COMERCIAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("COMERCIAL_DATABASE_URL/DATABASE_URL não configurado");
  }
  return getPoolByConnectionString(connectionString);
}

