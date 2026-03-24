import { NextResponse } from "next/server";
import { spawn } from "child_process";
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

export async function POST(req: Request) {
  try {
    await ensureCommercialTables();
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode ? String(body.mode) : "AUTO";
    const createdBy = body?.createdBy ? String(body.createdBy) : "SITE";
    const pythonBin = process.env.ROBO_SUPREMO_PYTHON_BIN || "python";
    const scriptPath = process.env.ROBO_SUPREMO_PATH || "";

    if (!scriptPath) {
      return NextResponse.json(
        { error: "ROBO_SUPREMO_PATH não configurado no ambiente." },
        { status: 400 }
      );
    }

    const state = global.__roboSupremoState || { running: false };
    if (state.running) {
      return NextResponse.json(
        {
          error: "Já existe uma execução em andamento.",
          runId: state.runId || null,
          pid: state.pid || null,
        },
        { status: 409 }
      );
    }

    const pool = getCommercialPool();
    const insert = await pool.query(
      `
        INSERT INTO public.tb_robo_supremo_runs
        (mode, status, trigger_source, started_at, created_by)
        VALUES ($1, 'RUNNING', 'SITE', NOW(), $2)
        RETURNING id
      `,
      [mode, createdBy]
    );
    const runId = Number(insert.rows?.[0]?.id || 0);

    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: process.env,
    });

    global.__roboSupremoState = {
      running: true,
      pid: child.pid || undefined,
      runId,
      startedAt: new Date().toISOString(),
    };

    let stdoutLog = "";
    let stderrLog = "";

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const s = String(chunk || "");
      stdoutLog += s;
      if (stdoutLog.length > 200_000) stdoutLog = stdoutLog.slice(-200_000);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const s = String(chunk || "");
      stderrLog += s;
      if (stderrLog.length > 200_000) stderrLog = stderrLog.slice(-200_000);
    });

    child.on("error", async (err) => {
      try {
        await pool.query(
          `
            UPDATE public.tb_robo_supremo_runs
            SET status = 'FAILED', finished_at = NOW(), exit_code = -1, stderr_log = $2, stdout_log = $3
            WHERE id = $1
          `,
          [runId, `${stderrLog}\n${String(err)}`, stdoutLog]
        );
      } catch (e) {
        console.error("Robo Supremo update error:", e);
      } finally {
        global.__roboSupremoState = { running: false };
      }
    });

    child.on("close", async (code) => {
      try {
        await pool.query(
          `
            UPDATE public.tb_robo_supremo_runs
            SET status = $2, finished_at = NOW(), exit_code = $3, stderr_log = $4, stdout_log = $5, pid = $6
            WHERE id = $1
          `,
          [
            runId,
            code === 0 ? "SUCCESS" : "FAILED",
            code === null || code === undefined ? -1 : Number(code),
            stderrLog,
            stdoutLog,
            child.pid || null,
          ]
        );
      } catch (e) {
        console.error("Robo Supremo close update error:", e);
      } finally {
        global.__roboSupremoState = { running: false };
      }
    });

    return NextResponse.json({
      success: true,
      runId,
      pid: child.pid || null,
      message: "Robô Supremo iniciado com sucesso.",
    });
  } catch (error) {
    console.error("Robo Supremo run POST error:", error);
    return NextResponse.json({ error: "Erro ao iniciar Robô Supremo" }, { status: 500 });
  }
}

