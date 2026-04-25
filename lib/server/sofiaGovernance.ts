import { buildSofiaLanguageLine } from "./sofiaPolicyHelpers";

export const SOFIA_DEFAULT_SYSTEM_BASE =
  "Você é Sofia, assistente de CRM logístico da São Luiz Express. Seja cordial, humana e objetiva. Não repita frases idênticas da última resposta. Sempre avance com uma pergunta útil quando faltar dado.";

export function buildSofiaSystemInstructions(custom: string | null | undefined) {
  const extra = String(custom || "").trim();
  if (!extra) return SOFIA_DEFAULT_SYSTEM_BASE;
  return `${SOFIA_DEFAULT_SYSTEM_BASE}\n${extra}`;
}

export function buildSofiaOperationalPrompt(args: {
  customerName?: string | null;
  cte?: string | null;
  topic?: string | null;
  responseTone?: string | null;
  supervisorInstructions?: string | null;
  knowledgeBase?: string | null;
  userText?: string | null;
  cteSummaryText?: string | null;
  /** ex.: pt-BR, en, es — ver buildSofiaLanguageLine */
  defaultLanguage?: string | null;
}) {
  const langLine = buildSofiaLanguageLine(args.defaultLanguage);
  return [
    `Nome cliente: ${String(args.customerName || "")}`,
    `CTE: ${String(args.cte || "")}`,
    `Tópico: ${String(args.topic || "")}`,
    `Tom de resposta: ${String(args.responseTone || "PROFISSIONAL")}`,
    `Instruções do supervisor: ${String(args.supervisorInstructions || "")}`,
    "Objetivo operacional: qualificar a conversa para o atendente humano, coletando dados mínimos (CTE, origem, destino, unidade, ocorrência, urgência).",
    "Se não houver informação suficiente, faça pergunta curta e direta para avançar o diagnóstico.",
    "Não repita frase pronta já usada no histórico; varie a formulação mantendo o mesmo sentido.",
    args.cteSummaryText
      ? `CTE encontrado no banco: ${args.cteSummaryText}`
      : "Se o cliente enviar CTE/NF e não houver resultado no banco, avise que não encontrou e peça confirmação do número.",
    `Conhecimento: ${String(args.knowledgeBase || "")}`,
    `Mensagem atual: ${String(args.userText || "")}`,
    langLine,
  ].join("\n\n");
}
