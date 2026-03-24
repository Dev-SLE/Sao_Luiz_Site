import { NextResponse } from "next/server";
import { getCommercialPool } from "../../../../../lib/server/db";
import { ensureCommercialTables } from "../../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

declare global {
  // eslint-disable-next-line no-var
  var __roboSupremoState:
    | {
        running: boolean;
        pid?: number;
        runId?: number;
        startedAt?: string;
      }
    | undefined;
}

export async function GET() {
  try {
    await ensureCommercialTables();
    const pool = getCommercialPool();
    const runsRes = await pool.query(
      `
        SELECT id, mode, status, trigger_source, started_at, finished_at, exit_code, pid, created_by
        FROM public.tb_robo_supremo_runs
        ORDER BY started_at DESC
        LIMIT 25
      `
    );

    const state = global.__roboSupremoState || { running: false };
    const scriptPath = process.env.ROBO_SUPREMO_PATH || "";
    const pythonBin = process.env.ROBO_SUPREMO_PYTHON_BIN || "python";

    return NextResponse.json({
      running: !!state.running,
      current: state.running
        ? {
            runId: state.runId || null,
            pid: state.pid || null,
            startedAt: state.startedAt || null,
          }
        : null,
      runtime: {
        pythonBin,
        scriptPath,
        ready: !!scriptPath,
      },
      runs: (runsRes.rows || []).map((r: any) => ({
        id: Number(r.id),
        mode: r.mode ? String(r.mode) : "",
        status: String(r.status || ""),
        triggerSource: String(r.trigger_source || ""),
        startedAt: r.started_at ? String(r.started_at) : null,
        finishedAt: r.finished_at ? String(r.finished_at) : null,
        exitCode: r.exit_code === null || r.exit_code === undefined ? null : Number(r.exit_code),
        pid: r.pid === null || r.pid === undefined ? null : Number(r.pid),
        createdBy: r.created_by ? String(r.created_by) : "",
      })),
    });
  } catch (error) {
    console.error("Robo Supremo status GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar status do Robô Supremo" }, { status: 500 });
  }
}

