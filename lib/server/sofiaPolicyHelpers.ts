export const SOFIA_AUTO_MODES = ["ASSISTIDO", "SEMI_AUTO", "AUTO_TOTAL", "CLASSIFICACAO", "DESLIGADA"] as const;

export function normalizeSofiaAutoMode(raw: string | null | undefined): string {
  const u = String(raw || "ASSISTIDO").toUpperCase();
  if ((SOFIA_AUTO_MODES as readonly string[]).includes(u)) return u;
  return "ASSISTIDO";
}

export type SofiaAiActionsAllowed = {
  manualSuggestReply: boolean;
  conversationSummary: boolean;
  autoReplyToCustomer: boolean;
  keywordHandoffAutoSend: boolean;
  classifyTopic: boolean;
  definePriority: boolean;
  suggestFunnelMove: boolean;
  autoUpdateTopic: boolean;
  runInboundClassification: boolean;
  /** Vincular CTE ao lead após resposta/classificação da Sofia (não usa mais regex só no webhook). */
  autoLinkCteFromConversation: boolean;
};

export const DEFAULT_AI_ACTIONS_ALLOWED: SofiaAiActionsAllowed = {
  manualSuggestReply: true,
  conversationSummary: true,
  autoReplyToCustomer: true,
  keywordHandoffAutoSend: true,
  classifyTopic: true,
  definePriority: true,
  suggestFunnelMove: true,
  autoUpdateTopic: false,
  runInboundClassification: false,
  autoLinkCteFromConversation: true,
};

export function parseAiActionsAllowed(raw: unknown): SofiaAiActionsAllowed {
  const base: SofiaAiActionsAllowed = { ...DEFAULT_AI_ACTIONS_ALLOWED };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  (
    [
      "manualSuggestReply",
      "conversationSummary",
      "autoReplyToCustomer",
      "keywordHandoffAutoSend",
      "classifyTopic",
      "definePriority",
      "suggestFunnelMove",
      "autoUpdateTopic",
      "runInboundClassification",
      "autoLinkCteFromConversation",
    ] as const
  ).forEach((k) => {
    if (typeof o[k] === "boolean") base[k] = o[k];
  });
  return base;
}

export type FunnelSlaRule = {
  stageKey: string;
  maxMinutes?: number | null;
  blockAiAutoReply?: boolean;
};

export function parseFunnelSlaRules(raw: unknown): FunnelSlaRule[] {
  if (!Array.isArray(raw)) return [];
  const out: FunnelSlaRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    const stageKey = String(x.stageKey ?? x.stage ?? "").trim().toUpperCase();
    if (!stageKey) continue;
    out.push({
      stageKey,
      maxMinutes: x.maxMinutes != null && x.maxMinutes !== "" ? Number(x.maxMinutes) : null,
      blockAiAutoReply: !!x.blockAiAutoReply,
    });
  }
  return out;
}

export function funnelRuleBlocksAuto(rules: FunnelSlaRule[], conversationStatus: string | null | undefined): boolean {
  const s = String(conversationStatus || "").toUpperCase();
  if (!s) return false;
  return rules.some((r) => r.stageKey === s && r.blockAiAutoReply);
}

export function funnelRuleMaxMinutesBreached(args: {
  rules: FunnelSlaRule[];
  conversationStatus: string | null | undefined;
  statusEnteredAt: string | Date | null | undefined;
  nowMs?: number;
}): boolean {
  const s = String(args.conversationStatus || "").toUpperCase();
  if (!s) return false;
  const rule = args.rules.find((r) => r.stageKey === s && Number(r.maxMinutes || 0) > 0);
  if (!rule) return false;
  const entered = args.statusEnteredAt ? new Date(args.statusEnteredAt).getTime() : Number.NaN;
  if (!Number.isFinite(entered)) return false;
  const now = Number.isFinite(args.nowMs as number) ? Number(args.nowMs) : Date.now();
  const elapsedMinutes = Math.floor((now - entered) / 60000);
  return elapsedMinutes > Number(rule.maxMinutes || 0);
}

/** Linha operacional de idioma injetada no prompt (evita hardcode só pt-BR). */
export function buildSofiaLanguageLine(lang: string | null | undefined): string {
  const l = String(lang || "pt-BR").trim().toLowerCase();
  if (l === "en" || l.startsWith("en-")) return "Respond in English, briefly and precisely.";
  if (l === "es" || l.startsWith("es-")) return "Responde en español, de forma breve y precisa.";
  return "Responda em pt-BR, curta e precisa.";
}
