import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureAppLogsTable, ensureOperationalAssignmentsTable } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

const ASSIGNMENT_TYPE = "PENDENTE_AG_BAIXAR";

const norm = (v: any) => String(v || "").trim();
const normSerie = (v: any) => norm(v) || "0";

async function logAssignmentEvent(payload: {
  event: string;
  username?: string | null;
  cte: string;
  serie: string;
  data?: any;
}) {
  try {
    await ensureAppLogsTable();
    const pool = getPool();
    await pool.query(
      `
        INSERT INTO pendencias.app_logs (level, source, event, username, cte, serie, payload)
        VALUES ('INFO', 'operacional', $1, $2, $3, $4, $5)
      `,
      [payload.event, payload.username || null, payload.cte, payload.serie, payload.data ? JSON.stringify(payload.data) : null]
    );
  } catch {}
}

export async function GET(req: Request) {
  try {
    await ensureOperationalAssignmentsTable();
    const { searchParams } = new URL(req.url);
    const cte = norm(searchParams.get("cte"));
    const serie = normSerie(searchParams.get("serie"));
    if (!cte) {
      return NextResponse.json({ error: "cte é obrigatório" }, { status: 400 });
    }
    const pool = getPool();
    const result = await pool.query(
      `
        SELECT
          id, cte, serie, assignment_type, agency_unit, assigned_username, notes,
          active, created_by, updated_by, created_at, updated_at
        FROM pendencias.cte_assignments
        WHERE cte = $1
          AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
          AND active = true
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [cte, serie]
    );
    return NextResponse.json({ assignment: result.rows?.[0] || null });
  } catch (error) {
    console.error("Erro ao buscar atribuição operacional:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureOperationalAssignmentsTable();
    const body = await req.json().catch(() => ({}));
    const cte = norm(body?.cte);
    const serie = normSerie(body?.serie);
    const agencyUnit = norm(body?.agencyUnit);
    const assignedUsername = norm(body?.assignedUsername);
    const notes = norm(body?.notes);
    const actor = norm(body?.actor) || null;

    if (!cte) return NextResponse.json({ error: "cte é obrigatório" }, { status: 400 });
    if (!agencyUnit) return NextResponse.json({ error: "agencyUnit é obrigatório" }, { status: 400 });
    if (!assignedUsername) return NextResponse.json({ error: "assignedUsername é obrigatório" }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
      `
        INSERT INTO pendencias.cte_assignments (
          cte, serie, assignment_type, agency_unit, assigned_username, notes,
          active, created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          true, $7, $7, NOW(), NOW()
        )
        ON CONFLICT (cte, serie, assignment_type) WHERE active = true
        DO UPDATE SET
          agency_unit = EXCLUDED.agency_unit,
          assigned_username = EXCLUDED.assigned_username,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `,
      [cte, serie, ASSIGNMENT_TYPE, agencyUnit, assignedUsername, notes || null, actor]
    );
    const assignment = result.rows?.[0] || null;
    await logAssignmentEvent({
      event: "CTE_ASSIGNMENT_UPSERT",
      username: actor,
      cte,
      serie,
      data: {
        assignmentType: ASSIGNMENT_TYPE,
        agencyUnit,
        assignedUsername,
      },
    });
    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error("Erro ao salvar atribuição operacional:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureOperationalAssignmentsTable();
    const { searchParams } = new URL(req.url);
    const cte = norm(searchParams.get("cte"));
    const serie = normSerie(searchParams.get("serie"));
    const actor = norm(searchParams.get("actor")) || null;
    if (!cte) return NextResponse.json({ error: "cte é obrigatório" }, { status: 400 });
    const pool = getPool();
    const result = await pool.query(
      `
        UPDATE pendencias.cte_assignments
        SET active = false, updated_by = $3, updated_at = NOW()
        WHERE cte = $1
          AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
          AND assignment_type = $4
          AND active = true
        RETURNING *
      `,
      [cte, serie, actor, ASSIGNMENT_TYPE]
    );
    await logAssignmentEvent({
      event: "CTE_ASSIGNMENT_CLEAR",
      username: actor,
      cte,
      serie,
      data: { assignmentType: ASSIGNMENT_TYPE, affected: result.rowCount || 0 },
    });
    return NextResponse.json({ success: true, cleared: result.rowCount || 0 });
  } catch (error) {
    console.error("Erro ao limpar atribuição operacional:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
