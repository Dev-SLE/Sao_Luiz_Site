import { extractCteFromText } from "./crmCteExtract";
import { applyInboundRouting } from "./crmRouting";

export type SofiaCteLinkArgs = {
  leadId: string;
  conversationId: string;
  /** Texto combinado da vez (ex.: mensagem cliente + rascunho IA). */
  combinedText: string;
  leadTitle?: string | null;
  dryRun?: boolean;
  /** Repasse para applyInboundRouting (ex.: tópico classificado por IA). */
  topicOverride?: string | null;
};

/**
 * Persiste CTE no lead apenas no fluxo da Sofia (após IA), atualiza reabertura se necessário
 * e reaplica roteamento/estágio com o CTE novo.
 * Não substitui regex nos webhooks — inbound bruto não grava mais CTE automaticamente.
 */
export async function persistSofiaLinkedCteAndInboundRoute(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows?: unknown[] }> },
  args: SofiaCteLinkArgs
): Promise<{ linked: boolean; cte: string | null }> {
  const detected = extractCteFromText(args.combinedText);
  if (!detected || args.dryRun) {
    return { linked: false, cte: detected };
  }
  const newCte = String(detected).trim();
  if (!newCte) return { linked: false, cte: null };

  const prevLead = await pool.query(
    `SELECT cte_number, customer_status FROM pendencias.crm_leads WHERE id = $1::uuid`,
    [args.leadId]
  );
  const prevRow = prevLead.rows?.[0] as { cte_number?: string | null; customer_status?: string | null } | undefined;
  const prevCte = String(prevRow?.cte_number || "").trim();
  if (prevCte === newCte) {
    return { linked: false, cte: newCte };
  }

  const cs = String(prevRow?.customer_status || "")
    .trim()
    .toUpperCase();
  const wasClosed =
    cs === "CONCLUIDO" ||
    cs === "PERDIDO" ||
    cs.includes("CONCLU") ||
    cs.includes("FINALIZ");
  const newShipment = Boolean(prevCte && newCte && prevCte !== newCte);
  const reopen = newShipment || (wasClosed && Boolean(newCte));

  await pool.query(
    `
      UPDATE pendencias.crm_leads
      SET
        cte_number = $1,
        customer_status = CASE WHEN $3::boolean THEN 'PENDENTE' ELSE customer_status END,
        updated_at = NOW()
      WHERE id = $2::uuid
    `,
    [newCte, args.leadId, reopen]
  );

  if (reopen) {
    try {
      await pool.query(
        `
          INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
          VALUES ($1::uuid, NULL, 'EVENT', $2, $3::jsonb, NOW())
        `,
        [
          args.leadId,
          newShipment
            ? "Sofia vinculou novo CTE ao lead — fluxo reaberto."
            : "Sofia vinculou CTE após atendimento encerrado — fluxo reaberto.",
          JSON.stringify({
            source: "sofia_cte_link",
            previousCte: prevCte || null,
            newCte,
            customer_status_reset: true,
          }),
        ]
      );
    } catch {
      // noop
    }
  } else {
    try {
      await pool.query(
        `
          INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
          VALUES ($1::uuid, NULL, 'EVENT', 'Sofia vinculou CTE ao lead.', $2::jsonb, NOW())
        `,
        [
          args.leadId,
          JSON.stringify({ source: "sofia_cte_link", previousCte: prevCte || null, newCte }),
        ]
      );
    } catch {
      // noop
    }
  }

  await applyInboundRouting({
    leadId: args.leadId,
    conversationId: args.conversationId,
    text: args.combinedText,
    title: args.leadTitle ?? null,
    cte: newCte,
    topicOverride: args.topicOverride ?? null,
  });

  return { linked: true, cte: newCte };
}
