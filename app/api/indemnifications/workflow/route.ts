import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables, ensureOccurrencesSchemaTables } from "../../../../lib/server/ensureSchema";
import { can, getSessionContext } from "../../../../lib/server/authorization";
import { addWorkflowEvent, canActOnWorkflow, insertOcorrenciasLog, loadIndemnificationContext } from "../../../../lib/server/indemnificationWorkflow";

export const runtime = "nodejs";

async function fullPayload(pool: any, indemnificationId: string) {
  const ctx = await loadIndemnificationContext(pool, indemnificationId);
  const fu = await pool.query(
    `SELECT f.*, a.name AS agency_name
     FROM pendencias.indemnification_agency_followups f
     LEFT JOIN pendencias.crm_agencies a ON a.id = f.agency_id
     WHERE f.indemnification_id = $1::uuid
     ORDER BY a.name NULLS LAST`,
    [indemnificationId]
  );
  return { ...ctx, followups: fu.rows || [] };
}

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    await ensureCrmSchemaTables();
    const { searchParams } = new URL(req.url);
    const indemnificationId = String(searchParams.get("indemnificationId") || "").trim();
    if (!indemnificationId) return NextResponse.json({ error: "indemnificationId obrigatório" }, { status: 400 });
    const pool = getPool();
    const data = await fullPayload(pool, indemnificationId);
    if (!data.indemnification) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[indemnifications.workflow.get]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session || !can(session, "module.operacional.view")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    await ensureOccurrencesSchemaTables();
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const indemnificationId = String(body?.indemnificationId || "").trim();
    const action = String(body?.action || "").trim();
    if (!indemnificationId) return NextResponse.json({ error: "indemnificationId obrigatório" }, { status: 400 });
    if (!action) return NextResponse.json({ error: "action obrigatório" }, { status: 400 });

    const ctx = await loadIndemnificationContext(pool, indemnificationId);
    if (!ctx.indemnification || !ctx.workflow) {
      return NextResponse.json({ error: "Indenização não encontrada" }, { status: 404 });
    }
    const ind = ctx.indemnification;
    const wf = ctx.workflow;
    const cte = ind.occurrence_cte || null;
    const serie = ind.occurrence_serie || "0";
    const actor = session.username;
    const role = session.role || "";

    const log = async (event: string, payload: Record<string, unknown>) => {
      await insertOcorrenciasLog(pool, event, actor, { indemnificationId, ...payload }, cte, serie);
    };

    const updateWf = async (fields: Record<string, unknown>) => {
      const keys = Object.keys(fields);
      if (keys.length === 0) return;
      const sets = keys.map((k, i) => `${k} = $${i + 2}`);
      const vals = keys.map((k) => fields[k]);
      await pool.query(
        `UPDATE pendencias.indemnification_workflows SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1::uuid`,
        [wf.id, ...vals]
      );
    };

    if (action === "update_fields") {
      const facts = body?.facts != null ? String(body.facts) : undefined;
      const responsibilities = body?.responsibilities != null ? String(body.responsibilities) : undefined;
      const indemnification_body = body?.indemnification_body != null ? String(body.indemnification_body) : undefined;
      const others = body?.others != null ? String(body.others) : undefined;
      const editComment = body?.editComment != null ? String(body.editComment).trim() : "";

      const old = {
        facts: ind.facts,
        responsibilities: ind.responsibilities,
        indemnification_body: ind.indemnification_body,
        others: ind.others,
      };

      await pool.query(
        `UPDATE pendencias.indemnifications SET
          facts = COALESCE($2, facts),
          responsibilities = COALESCE($3, responsibilities),
          indemnification_body = COALESCE($4, indemnification_body),
          others = COALESCE($5, others),
          updated_at = NOW()
        WHERE id = $1::uuid`,
        [indemnificationId, facts ?? null, responsibilities ?? null, indemnification_body ?? null, others ?? null]
      );

      const changed: string[] = [];
      if (facts !== undefined && facts !== (old.facts || "")) changed.push("facts");
      if (responsibilities !== undefined && responsibilities !== (old.responsibilities || "")) changed.push("responsibilities");
      if (indemnification_body !== undefined && indemnification_body !== (old.indemnification_body || ""))
        changed.push("indemnification_body");
      if (others !== undefined && others !== (old.others || "")) changed.push("others");

      if (changed.length > 0) {
        await addWorkflowEvent(pool, wf.id, "EDITED", actor, editComment || "Campos atualizados", {
          fields: changed,
          comment: editComment,
        });
        await log("INDEM_FIELD_EDIT", { fields: changed });
      }

      const fresh = await fullPayload(pool, indemnificationId);
      return NextResponse.json(fresh);
    }

    if (action === "submit_approval") {
      const assigneeUsername = String(body?.assigneeUsername || "").trim();
      const confirmSend = !!body?.confirmSend;
      if (!confirmSend) {
        return NextResponse.json({ error: "Marque a confirmação de envio para aprovação" }, { status: 400 });
      }
      if (!assigneeUsername) return NextResponse.json({ error: "assigneeUsername obrigatório" }, { status: 400 });
      const st = String(wf.state || "").toUpperCase();
      if (!["RASCUNHO", "DEVOLVIDO"].includes(st)) {
        return NextResponse.json({ error: "Estado não permite envio para aprovação" }, { status: 400 });
      }
      await updateWf({
        state: "AGUARDANDO_APROVACAO",
        previous_assignee: actor,
        current_assignee: assigneeUsername,
        rejection_reason: null,
      });
      await addWorkflowEvent(pool, wf.id, "SUBMITTED_FOR_APPROVAL", actor, `Enviado para aprovação de ${assigneeUsername}`, {
        assignee: assigneeUsername,
      });
      await log("INDEM_SUBMIT_APPROVAL", { assignee: assigneeUsername });
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    if (action === "reject") {
      const reason = String(body?.reason || "").trim();
      if (!reason) return NextResponse.json({ error: "Informe o motivo da rejeição" }, { status: 400 });
      if (String(wf.state || "").toUpperCase() !== "AGUARDANDO_APROVACAO") {
        return NextResponse.json({ error: "Só é possível rejeitar quando aguardando aprovação" }, { status: 400 });
      }
      if (!canActOnWorkflow(actor, role, wf.current_assignee, wf.state)) {
        return NextResponse.json({ error: "Apenas o responsável atual pode rejeitar" }, { status: 403 });
      }
      const backTo = wf.previous_assignee || null;
      await updateWf({
        state: "DEVOLVIDO",
        current_assignee: backTo,
        previous_assignee: actor,
        rejection_reason: reason,
      });
      await addWorkflowEvent(pool, wf.id, "REJECTED", actor, reason, { returnedTo: backTo });
      await log("INDEM_REJECTED", { reason, returnedTo: backTo });
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    if (action === "approve") {
      if (String(wf.state || "").toUpperCase() !== "AGUARDANDO_APROVACAO") {
        return NextResponse.json({ error: "Não está aguardando aprovação" }, { status: 400 });
      }
      if (!canActOnWorkflow(actor, role, wf.current_assignee, wf.state)) {
        return NextResponse.json({ error: "Apenas o aprovador designado pode aprovar" }, { status: 403 });
      }
      const nextAssignee = String(body?.nextAssignee || "").trim();
      if (nextAssignee) {
        await updateWf({
          state: "LANCAMENTOS",
          previous_assignee: actor,
          current_assignee: nextAssignee,
          rejection_reason: null,
        });
        await addWorkflowEvent(pool, wf.id, "APPROVED", actor, `Aprovado; lançamentos atribuídos a ${nextAssignee}`, {
          nextAssignee,
        });
        await log("INDEM_APPROVED_LANCAMENTOS", { nextAssignee });
      } else {
        await updateWf({
          state: "APROVADO",
          previous_assignee: actor,
          current_assignee: null,
          rejection_reason: null,
        });
        await addWorkflowEvent(pool, wf.id, "APPROVED", actor, "Aprovado", {});
        await log("INDEM_APPROVED", {});
      }
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    if (action === "assign_lancamentos") {
      const assigneeUsername = String(body?.assigneeUsername || "").trim();
      if (!assigneeUsername) return NextResponse.json({ error: "assigneeUsername obrigatório" }, { status: 400 });
      if (String(wf.state || "").toUpperCase() !== "APROVADO") {
        return NextResponse.json({ error: "Atribua lançamentos apenas após aprovação" }, { status: 400 });
      }
      await updateWf({
        state: "LANCAMENTOS",
        previous_assignee: actor,
        current_assignee: assigneeUsername,
      });
      await addWorkflowEvent(pool, wf.id, "ASSIGNED", actor, `Lançamentos: ${assigneeUsername}`, { assignee: assigneeUsername });
      await log("INDEM_ASSIGNED_LANCAMENTOS", { assignee: assigneeUsername });
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    if (action === "forward_finance") {
      const stFin = String(wf.state || "").toUpperCase();
      if (!["LANCAMENTOS", "APROVADO"].includes(stFin)) {
        return NextResponse.json({ error: "Encaminhe ao financeiro a partir de Aprovado ou Lançamentos" }, { status: 400 });
      }
      const financeAssignee = String(body?.financeAssignee || "").trim() || null;
      await updateWf({
        state: "AGUARDANDO_FINANCEIRO",
        previous_assignee: wf.current_assignee || actor,
        current_assignee: financeAssignee,
      });
      await addWorkflowEvent(pool, wf.id, "FORWARDED_FINANCE", actor, "Encaminhado ao financeiro", {
        financeAssignee,
      });
      await log("INDEM_FORWARD_FINANCE", { financeAssignee });
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    if (action === "comment") {
      const text = String(body?.text || "").trim();
      if (!text) return NextResponse.json({ error: "text obrigatório" }, { status: 400 });
      await addWorkflowEvent(pool, wf.id, "COMMENT", actor, text, {});
      await log("INDEM_COMMENT", { text: text.slice(0, 200) });
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    if (action === "mark_posted") {
      if (!canActOnWorkflow(actor, role, wf.current_assignee, wf.state)) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }
      await addWorkflowEvent(pool, wf.id, "POSTED", actor, String(body?.message || "Lançamento registrado"), {});
      await log("INDEM_POSTED", {});
      return NextResponse.json(await fullPayload(pool, indemnificationId));
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[indemnifications.workflow.post]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
