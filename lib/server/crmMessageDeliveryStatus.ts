/**
 * Alinha com o mapeamento em app/api/crm/messages/route.ts (GET).
 * Usado na lista de conversas para ticks tipo WhatsApp na última mensagem.
 */
export function computeCrmOutboundDeliveryStatus(row: {
  sender_type?: string | null;
  provider?: string | null;
  metadata?: unknown;
}): "pending" | "sent" | "delivered" | "read" | "failed" | "received" {
  const senderUpper = String(row.sender_type || "").toUpperCase();
  const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
  const outbound = meta.outbound_whatsapp as Record<string, unknown> | undefined;
  const raw = String(outbound?.status || "").trim().toLowerCase();
  const delivered =
    outbound?.delivered === true ||
    outbound?.delivered === "true" ||
    raw === "delivered" ||
    raw === "read" ||
    raw === "played";
  const isFailedLike = raw === "failed" || raw === "error";
  const attemptedOutbound = outbound?.attempted === true || outbound?.attempted === "true";
  const providerUpper = String(row.provider || "").toUpperCase();
  const fromMeMirror =
    meta.from_me === true || String(meta.from_me || "").toLowerCase() === "true";
  const mirroredEvolutionOutbound =
    (senderUpper === "AGENT" || senderUpper === "AGENTE" || senderUpper === "IA") &&
    providerUpper === "EVOLUTION" &&
    !attemptedOutbound &&
    fromMeMirror;

  if (senderUpper === "CLIENT") return "received";
  if (delivered) {
    if (raw === "read" || raw === "played") return "read";
    return "delivered";
  }
  if (isFailedLike) return "failed";
  if (raw === "sent") return "sent";
  if (mirroredEvolutionOutbound) return "sent";
  return "pending";
}
