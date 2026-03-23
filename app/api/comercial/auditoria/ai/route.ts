import { NextResponse } from "next/server";

export const runtime = "nodejs";

function sanitizePlan(text: string) {
  return String(text || "").replace(/\*\*/g, "*").trim();
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 380,
      },
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  return sanitizePlan(String(text));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const agencia = String(body?.agencia || "").trim();
    const perc = Number(body?.percProjetado || 0);
    const motivo = String(body?.motivoQueda || "").trim();
    const resumo = String(body?.resumoResposta || "").trim();

    if (!resumo) {
      return NextResponse.json({
        suggestion:
          "⚠️ Escreva um pequeno resumo do áudio primeiro para a IA poder analisar!",
      });
    }

    const prompt = `
Você é um Diretor Comercial/Logístico sênior.
A agência ${agencia || "N/D"} está projetando atingir apenas ${Number.isFinite(perc) ? perc.toFixed(1) : "0"}% da meta.
A causa raiz é: ${motivo || "Não informada"}.
Resumo do gerente da ponta: "${resumo}".

Crie um plano de ação prático, em no máximo 4 tópicos curtos para execução hoje.
Seja objetivo, com foco em recuperação de receita, negociação e disciplina operacional.

REGRAS:
- Responda em pt-BR.
- Não use markdown com **.
- Se quiser destacar algo, use apenas *palavra*.
`.trim();

    const suggestion =
      (await callGemini(prompt)) ||
      sanitizePlan(
        `1) Validar com ${agencia || "a agência"} os 3 maiores clientes perdidos nos últimos 15 dias e plano de recuperação imediato.\n` +
          `2) Definir meta diária de reação para superar ${Number.isFinite(perc) ? perc.toFixed(1) : "0"}% projetado e acompanhar no fim de cada dia.\n` +
          `3) Executar ação comercial ativa (lista de oportunidades + oferta + follow-up) com dono e prazo.\n` +
          `4) Retornar ao supervisor ainda hoje com resultado parcial e próximos bloqueios para decisão.`
      );

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Comercial auditoria AI POST error:", error);
    return NextResponse.json({ error: "Erro ao gerar plano de ação com IA" }, { status: 500 });
  }
}

