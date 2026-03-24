import { getPool } from "./db";
import { ensureAppLogsTable } from "./ensureSchema";

export async function serverLog(payload: {
  level?: "INFO" | "WARN" | "ERROR";
  source?: string;
  event: string;
  username?: string | null;
  cte?: string | null;
  serie?: string | null;
  data?: any;
}) {
  try {
    await ensureAppLogsTable();
    const pool = getPool();
    await pool.query(
      `
        INSERT INTO pendencias.app_logs (level, source, event, username, cte, serie, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        String(payload.level || "INFO").toUpperCase(),
        payload.source || "api",
        payload.event,
        payload.username ?? null,
        payload.cte ?? null,
        payload.serie ?? null,
        payload.data ? JSON.stringify(payload.data) : null,
      ]
    );
  } catch {
    // não propagar falha de logging
  }
}

