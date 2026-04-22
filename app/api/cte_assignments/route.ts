import { NextResponse } from "next/server";
import { getPool } from "../../../lib/server/db";
import { ensureAppLogsTable, ensureOperationalAssignmentsTable } from "../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../lib/server/authorization";
import { isAdminSuperRole } from "../../../lib/adminSuperRoles";
import { operationalCteUnitScopeAndClause } from "../../../lib/server/operationalCteUnitScope";
import type { Pool } from "pg";

export const runtime = "nodejs";

const ASSIGNMENT_TYPE = "PENDENTE_AG_BAIXAR";

const norm = (v: any) => String(v || "").trim();
const normSerie = (v: any) => norm(v) || "0";

async function operationalCteAccessible(
  pool: Pool,
  session: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>,
  cte: string,
  serie: string
) {
  const hasOperationalGlobal = can(session, "scope.operacional.all") || isAdminSuperRole(session.role, session.username);
  if (hasOperationalGlobal) return true;
  const d = String(session.dest || "").trim();
  const o = String(session.origin || "").trim();
  if (!d && !o) return true;
  const scope = operationalCteUnitScopeAndClause(3, 4);
  const r = await pool.query(
    `
      SELECT 1
      FROM pendencias.ctes c
      WHERE c.cte = $1
        AND (c.serie = $2 OR ltrim(c.serie::text, '0') = ltrim($2::text, '0'))
        ${scope}
      LIMIT 1
    `,
    [cte, serie, d || null, o || null]
  );
  return (r.rowCount ?? 0) > 0;
}

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
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
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
    let assignment = result.rows?.[0] || null;
    if (assignment && !(await operationalCteAccessible(pool, session, cte, serie))) {
      assignment = null;
    }
    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Erro ao buscar atribuição operacional:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

async function upsertOneAssignment(
  pool: Pool,
  session: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>,
  input: {
    cte: string;
    serie: string;
    agencyUnit: string;
    assignedUsername: string;
    notes: string;
    actor: string | null;
  },
) {
  const { cte, serie, agencyUnit, assignedUsername, notes, actor } = input;
  if (!(await operationalCteAccessible(pool, session, cte, serie))) {
    return { ok: false as const, error: "CTE fora do escopo da sua unidade" };
  }
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
  return { ok: true as const, assignment };
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "operacional.assignment.assign")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOperationalAssignmentsTable();
    const body = await req.json().catch(() => ({}));
    const agencyUnit = norm(body?.agencyUnit);
    const assignedUsername = norm(body?.assignedUsername);
    const notes = norm(body?.notes);
    const actor = norm(body?.actor) || session.username || null;
    const pool = getPool();

    const bulkRaw = Array.isArray(body?.items) ? body.items : null;
    if (bulkRaw && bulkRaw.length > 0) {
      if (!agencyUnit) return NextResponse.json({ error: "agencyUnit é obrigatório" }, { status: 400 });
      if (!assignedUsername) return NextResponse.json({ error: "assignedUsername é obrigatório" }, { status: 400 });
      const maxBulk = 200;
      const items = bulkRaw.slice(0, maxBulk);
      let saved = 0;
      const failures: { cte: string; serie: string; error: string }[] = [];
      for (const it of items) {
        const cte = norm((it as { cte?: string })?.cte);
        const serie = normSerie((it as { serie?: string })?.serie);
        if (!cte) continue;
        const r = await upsertOneAssignment(pool, session, {
          cte,
          serie,
          agencyUnit,
          assignedUsername,
          notes,
          actor,
        });
        if (r.ok) saved += 1;
        else failures.push({ cte, serie, error: r.error });
      }
      return NextResponse.json({ success: true, saved, failures, bulk: true });
    }

    const cte = norm(body?.cte);
    const serie = normSerie(body?.serie);

    if (!cte) return NextResponse.json({ error: "cte é obrigatório" }, { status: 400 });
    if (!agencyUnit) return NextResponse.json({ error: "agencyUnit é obrigatório" }, { status: 400 });
    if (!assignedUsername) return NextResponse.json({ error: "assignedUsername é obrigatório" }, { status: 400 });

    const r = await upsertOneAssignment(pool, session, {
      cte,
      serie,
      agencyUnit,
      assignedUsername,
      notes,
      actor,
    });
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, assignment: r.assignment, bulk: false });
  } catch (error) {
    console.error("Erro ao salvar atribuição operacional:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "operacional.assignment.unassign")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOperationalAssignmentsTable();
    const { searchParams } = new URL(req.url);
    const cte = norm(searchParams.get("cte"));
    const serie = normSerie(searchParams.get("serie"));
    const actor = norm(searchParams.get("actor")) || session.username || null;
    const reason = norm(searchParams.get("reason"));
    if (!cte) return NextResponse.json({ error: "cte é obrigatório" }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "Motivo da devolução é obrigatório" }, { status: 400 });
    const pool = getPool();
    if (!(await operationalCteAccessible(pool, session, cte, serie))) {
      return NextResponse.json({ error: "CTE fora do escopo da sua unidade" }, { status: 403 });
    }
    const result = await pool.query(
      `
        UPDATE pendencias.cte_assignments
        SET
          active = false,
          updated_by = $3,
          updated_at = NOW(),
          return_reason = $5,
          returned_by = $3,
          returned_at = NOW()
        WHERE cte = $1
          AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
          AND assignment_type = $4
          AND active = true
        RETURNING *
      `,
      [cte, serie, actor, ASSIGNMENT_TYPE, reason]
    );
    const prevRow = result.rows?.[0] as { assigned_username?: string } | undefined;
    const previousAssignedUsername = norm(prevRow?.assigned_username);
    await logAssignmentEvent({
      event: "CTE_ASSIGNMENT_CLEAR",
      username: actor,
      cte,
      serie,
      data: {
        assignmentType: ASSIGNMENT_TYPE,
        affected: result.rowCount || 0,
        reason,
        previousAssignedUsername: previousAssignedUsername || undefined,
      },
    });
    return NextResponse.json({ success: true, cleared: result.rowCount || 0 });
  } catch (error) {
    console.error("Erro ao limpar atribuição operacional:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
