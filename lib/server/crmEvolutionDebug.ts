/** Logs extra no webhook `messages.upsert` (Vercel: ativar só durante diagnóstico). */
export function crmEvolutionUpsertDebugEnabled(): boolean {
  const v = process.env.CRM_EVOLUTION_UPSERT_DEBUG;
  return v === "1" || String(v || "").toLowerCase() === "true";
}

/** Logs extra no pipeline ingest / getBase64. Herda `CRM_EVOLUTION_UPSERT_DEBUG` se só uma flag for definida. */
export function crmEvolutionMediaDebugEnabled(): boolean {
  const v = process.env.CRM_EVOLUTION_MEDIA_DEBUG ?? process.env.CRM_EVOLUTION_UPSERT_DEBUG;
  return v === "1" || String(v || "").toLowerCase() === "true";
}

/**
 * Log `[evolution-webhook] event_payload_diag` em **todos** os eventos (não só upsert):
 * `messageType` na árvore do body + pistas de proto (imageMessage, etc.).
 * Ativar `CRM_EVOLUTION_WEBHOOK_EVENT_DIAG=1` ou `CRM_EVOLUTION_UPSERT_DEBUG=1`.
 */
export function crmEvolutionWebhookEventDiagEnabled(): boolean {
  const v = process.env.CRM_EVOLUTION_WEBHOOK_EVENT_DIAG ?? process.env.CRM_EVOLUTION_UPSERT_DEBUG;
  return v === "1" || String(v || "").toLowerCase() === "true";
}

/** URL do webhook com `token` mascarado (primeiros 4 + últimos 4) para logs e respostas API. */
export function maskEvolutionWebhookUrlForLog(webhookUrl: string): string {
  const s = String(webhookUrl || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const t = u.searchParams.get("token");
    if (!t) return s;
    const masked = t.length <= 8 ? "***" : `${t.slice(0, 4)}…${t.slice(-4)}`;
    u.searchParams.set("token", masked);
    return u.toString();
  } catch {
    return s.replace(/([?&]token=)([^&]+)/i, (_, p: string, tok: string) => {
      const t = String(tok || "");
      const masked = t.length <= 8 ? "***" : `${decodeURIComponent(t).slice(0, 4)}…${decodeURIComponent(t).slice(-4)}`;
      return `${p}${encodeURIComponent(masked)}`;
    });
  }
}
