/**
 * Chamadas HTTP à OpenAI / Gemini com timeout e métricas mínimas para auditoria.
 * Não logar corpo de mensagens nem dados de cliente.
 */

export type AiChatHttpResult = {
  text: string | null;
  ok: boolean;
  httpStatus: number;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  errorLabel: "missing_key" | "timeout" | "http_error" | "parse_error" | "empty_response" | null;
};

function openAiTimeoutMs(): number {
  const n = Number(process.env.OPENAI_HTTP_TIMEOUT_MS ?? "45000");
  if (!Number.isFinite(n)) return 45000;
  return Math.min(120000, Math.max(5000, Math.floor(n)));
}

function geminiTimeoutMs(): number {
  const n = Number(process.env.GEMINI_HTTP_TIMEOUT_MS ?? "45000");
  if (!Number.isFinite(n)) return 45000;
  return Math.min(120000, Math.max(5000, Math.floor(n)));
}

function logAiFailure(scope: string, provider: string, r: AiChatHttpResult) {
  if (r.ok) return;
  try {
    console.warn(
      `[ai-${provider.toLowerCase()}]`,
      JSON.stringify({
        scope,
        ok: r.ok,
        httpStatus: r.httpStatus,
        errorLabel: r.errorLabel,
        latencyMs: r.latencyMs,
      })
    );
  } catch {
    /* ignore */
  }
}

export async function openAiChatCompletion(args: {
  scope: string;
  model: string;
  temperature: number;
  messages: { role: string; content: string }[];
}): Promise<AiChatHttpResult> {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const started = Date.now();
  if (!apiKey) {
    return {
      text: null,
      ok: false,
      httpStatus: 0,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      errorLabel: "missing_key",
    };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), openAiTimeoutMs());
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        temperature: args.temperature,
        messages: args.messages,
      }),
    });
    const latencyMs = Date.now() - started;
    const json = await resp.json().catch(() => ({}));
    const usage = (json as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
    const textRaw = (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
    const text = textRaw != null && String(textRaw).length ? String(textRaw) : null;
    if (!resp.ok) {
      const r: AiChatHttpResult = {
        text: null,
        ok: false,
        httpStatus: resp.status,
        latencyMs,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        errorLabel: "http_error",
      };
      logAiFailure(args.scope, "OPENAI", r);
      return r;
    }
    if (!text) {
      const r: AiChatHttpResult = {
        text: null,
        ok: false,
        httpStatus: resp.status,
        latencyMs,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        errorLabel: "empty_response",
      };
      logAiFailure(args.scope, "OPENAI", r);
      return r;
    }
    return {
      text,
      ok: true,
      httpStatus: resp.status,
      latencyMs,
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      errorLabel: null,
    };
  } catch (e: unknown) {
    const latencyMs = Date.now() - started;
    const aborted = e instanceof Error && e.name === "AbortError";
    const r: AiChatHttpResult = {
      text: null,
      ok: false,
      httpStatus: 0,
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorLabel: aborted ? "timeout" : "parse_error",
    };
    logAiFailure(args.scope, "OPENAI", r);
    return r;
  } finally {
    clearTimeout(t);
  }
}

export async function geminiGenerateContent(args: {
  scope: string;
  model: string;
  temperature: number;
  contents: unknown[];
}): Promise<AiChatHttpResult> {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  const started = Date.now();
  if (!apiKey) {
    return {
      text: null,
      ok: false,
      httpStatus: 0,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      errorLabel: "missing_key",
    };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    args.model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), geminiTimeoutMs());
  try {
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: args.temperature },
        contents: args.contents,
      }),
    });
    const latencyMs = Date.now() - started;
    const json = await resp.json().catch(() => ({}));
    const meta = (json as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
    const textRaw = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]
      ?.content?.parts?.[0]?.text;
    const text = textRaw != null && String(textRaw).length ? String(textRaw) : null;
    if (!resp.ok) {
      const r: AiChatHttpResult = {
        text: null,
        ok: false,
        httpStatus: resp.status,
        latencyMs,
        inputTokens: meta?.promptTokenCount ?? null,
        outputTokens: meta?.candidatesTokenCount ?? null,
        errorLabel: "http_error",
      };
      logAiFailure(args.scope, "GEMINI", r);
      return r;
    }
    if (!text) {
      const r: AiChatHttpResult = {
        text: null,
        ok: false,
        httpStatus: resp.status,
        latencyMs,
        inputTokens: meta?.promptTokenCount ?? null,
        outputTokens: meta?.candidatesTokenCount ?? null,
        errorLabel: "empty_response",
      };
      logAiFailure(args.scope, "GEMINI", r);
      return r;
    }
    return {
      text,
      ok: true,
      httpStatus: resp.status,
      latencyMs,
      inputTokens: meta?.promptTokenCount ?? null,
      outputTokens: meta?.candidatesTokenCount ?? null,
      errorLabel: null,
    };
  } catch (e: unknown) {
    const latencyMs = Date.now() - started;
    const aborted = e instanceof Error && e.name === "AbortError";
    const r: AiChatHttpResult = {
      text: null,
      ok: false,
      httpStatus: 0,
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorLabel: aborted ? "timeout" : "parse_error",
    };
    logAiFailure(args.scope, "GEMINI", r);
    return r;
  } finally {
    clearTimeout(t);
  }
}
