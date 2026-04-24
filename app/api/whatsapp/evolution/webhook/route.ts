import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { applyInboundRouting, resolveInboxDefaultAssignment } from "../../../../../lib/server/crmRouting";
import { ensureDefaultPipelineAndFirstStage } from "../../../../../lib/server/crmDefaultPipeline";
import {
  bodyTextFromEvolutionMessageTypeHint,
  evolutionNumberDigits,
  evolutionFetchProfilePictureUrl,
  evolutionWebhookRootMessageType,
  extractEvolutionMessageText,
} from "../../../../../lib/server/evolutionClient";
import { evolutionQrCaptureFromWebhook } from "../../../../../lib/server/evolutionLastQr";
import {
  countEvolutionInboundMediaSlots,
  ingestEvolutionInboundMedia,
  unwrapEvolutionInner,
} from "../../../../../lib/server/crmMediaIngest";
import { crmPhoneSuffixForTitle, crmStripTrailingTitlePhone } from "../../../../../lib/server/crmPhoneDisplay";
import {
  applyCrmMessageDeleteByWaMessageId,
  applyCrmMessageEditByWaMessageId,
} from "../../../../../lib/server/crmMessageWaMirror";

export const runtime = "nodejs";

/** Prioriza rótulos de mídia sobre "[Mensagem recebida]" quando o payload Evolution vem em duas fases. */
function rankEvolutionBodyLabel(s: string): number {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return 0;
  if (t === "[mensagem recebida]" || t === "[mensagem sem texto]") return 1;
  if (/^\[[^\]]+(recebida|recebido)\]$/i.test(t)) return 3;
  return 2;
}

function preferEvolutionInboundBody(...parts: string[]): string {
  let best = "[Mensagem sem texto]";
  let bestR = 0;
  for (const p of parts) {
    if (!p) continue;
    const r = rankEvolutionBodyLabel(p);
    if (r > bestR || (r === bestR && r >= 2 && String(p).length > String(best).length)) {
      bestR = r;
      best = p;
    }
  }
  return best;
}

/** connection.update: log detalhado no máximo a cada 8s por instância. */
const lastConnectionDetailLogAt = new Map<string, number>();

function extractCteFromText(text: string): string | null {
  const raw = String(text || "");
  if (/^\s*\d{3,12}\s*$/.test(raw)) return raw.trim();
  const longDigits = raw.match(/\b\d{5,}\b/);
  if (longDigits) return longDigits[0];
  const cteHint = raw.match(/\bcte\b[^0-9]{0,10}(\d{3,12})\b/i);
  if (cteHint?.[1]) return cteHint[1];
  return null;
}

function lastN(input: string, n: number) {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length <= n) return d;
  return d.slice(-n);
}

/** Mensagens em WAIT iam para sample_text do buffer mas não para crm_messages — gerava “furo” no histórico. */
function buildPriorIntakeReplayBody(sampleText: string, currentMessageText: string): string | null {
  const full = String(sampleText || "").trim();
  if (!full) return null;
  const lines = full
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const cur = String(currentMessageText || "").trim();
  let parts = lines;
  if (cur && parts.length && parts[parts.length - 1] === cur) {
    parts = parts.slice(0, -1);
  }
  if (!parts.length) return null;
  return `📋 Mensagens recebidas antes da liberação no CRM:\n\n${parts.join("\n\n—\n\n")}`;
}

function logUpsertSkip(reason: string, ctx: Record<string, unknown>) {
  console.warn("[evolution-webhook] message_not_persisted", { reason, ...ctx });
}

async function getOrMergeWhatsappConversationByLead(pool: any, leadId: string, preferredInboxId?: string | null) {
  const convsRes = await pool.query(
    `
      SELECT id, whatsapp_inbox_id, created_at
      FROM pendencias.crm_conversations
      WHERE lead_id = $1::uuid
        AND channel = 'WHATSAPP'
        AND is_active = true
      ORDER BY created_at ASC
    `,
    [leadId]
  );
  const convs = convsRes.rows || [];
  if (!convs.length) return null;
  const primary = convs[0];
  const primaryId = String(primary.id);
  const extraIds = convs.slice(1).map((c: any) => String(c.id));

  if (extraIds.length) {
    await pool.query(
      `
        UPDATE pendencias.crm_messages
        SET conversation_id = $1::uuid
        WHERE conversation_id = ANY($2::uuid[])
      `,
      [primaryId, extraIds]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_outbox
        SET conversation_id = $1::uuid
        WHERE conversation_id = ANY($2::uuid[])
      `,
      [primaryId, extraIds]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET is_active = false, updated_at = NOW()
        WHERE id = ANY($1::uuid[])
      `,
      [extraIds]
    );
  }

  if (preferredInboxId && !primary.whatsapp_inbox_id) {
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET whatsapp_inbox_id = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [primaryId, preferredInboxId]
    );
  }

  return primaryId;
}

function extractProfilePhotoUrl(item: any): string | null {
  if (!item || typeof item !== "object") return null;
  const candidates = [
    item.profilePicUrl,
    item.profilePictureUrl,
    item.pictureUrl,
    item.avatarUrl,
    item.contactPhotoUrl,
    item?.data?.profilePicUrl,
    item?.data?.profilePictureUrl,
    item?.data?.pictureUrl,
    item?.data?.avatarUrl,
    item?.data?.contactPhotoUrl,
    item.imgUrl,
    item?.message?.imgUrl,
  ];
  for (const c of candidates) {
    const u = String(c || "").trim();
    if (u && /^https?:\/\//i.test(u)) return u;
  }
  return null;
}

function isUsableProfileName(value: string | null | undefined): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (low === "undefined" || low === "null" || low === "sem nome") return false;
  if (/^whatsapp(\s|$)/i.test(s)) return false;
  if (/^contato web(\s|$)/i.test(s)) return false;
  if (/^\+?\d[\d\s().-]{6,}$/.test(s)) return false;
  return true;
}

function extractProfileNameFromEvolutionItem(item: any): string | null {
  if (!item || typeof item !== "object") return null;
  const candidates = [
    item.pushName,
    item.verifiedBizName,
    item.senderName,
    item.fromName,
    item.contactName,
    item.notifyName,
    item?.key?.pushName,
    item?.data?.pushName,
    item?.data?.verifiedBizName,
    item?.data?.senderName,
    item?.data?.fromName,
    item?.data?.contactName,
    item?.data?.notifyName,
  ];
  for (const c of candidates) {
    const name = String(c || "").trim();
    if (isUsableProfileName(name)) return name;
  }
  return null;
}

async function getOrMergeLeadByPhoneLast10(pool: any, phoneLast10: string) {
  const leadsRes = await pool.query(
    `
      SELECT id, title, contact_phone, contact_avatar_url, created_at
      FROM pendencias.crm_leads
      WHERE contact_phone IS NOT NULL
        AND RIGHT(regexp_replace(contact_phone, '\\D', '', 'g'), 10) = $1
      ORDER BY created_at ASC
    `,
    [phoneLast10]
  );
  const leads = leadsRes.rows || [];
  if (!leads.length) return null;
  const primary = leads[0];
  const primaryId = String(primary.id);
  const duplicateIds = leads.slice(1).map((l: any) => String(l.id));
  if (duplicateIds.length) {
    await pool.query(
      `
        UPDATE pendencias.crm_conversations
        SET lead_id = $1::uuid
        WHERE lead_id = ANY($2::uuid[])
      `,
      [primaryId, duplicateIds]
    );
    await pool.query(
      `
        UPDATE pendencias.crm_activities
        SET lead_id = $1::uuid
        WHERE lead_id = ANY($2::uuid[])
      `,
      [primaryId, duplicateIds]
    );
    await pool.query(
      `
        DELETE FROM pendencias.crm_leads
        WHERE id = ANY($1::uuid[])
      `,
      [duplicateIds]
    );
  }
  return primary;
}

function parseLast10ListFromEnv(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  const parts = String(raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  for (const p of parts) {
    const d = p.replace(/\D/g, "");
    if (!d) continue;
    out.add(lastN(d, 10));
  }
  return out;
}

async function callOpenAiForIntake(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) return null;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Classifique contato para CRM logístico. Responda somente CREATE, WAIT ou SKIP.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  return json?.choices?.[0]?.message?.content ? String(json.choices[0].message.content) : null;
}

async function callGeminiForIntake(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0.2 },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? String(text) : null;
}

async function aiIntakeDecision(prompt: string): Promise<"CREATE" | "WAIT" | "SKIP" | null> {
  const provider = String(process.env.AI_PROVIDER || "OPENAI").toUpperCase();
  const raw =
    provider === "GEMINI" ? await callGeminiForIntake(prompt) : await callOpenAiForIntake(prompt);
  if (!raw) return null;
  const t = raw.toUpperCase();
  if (t.includes("CREATE")) return "CREATE";
  if (t.includes("SKIP")) return "SKIP";
  if (t.includes("WAIT")) return "WAIT";
  return null;
}

async function loadIntakeSettings(pool: any) {
  const res = await pool.query(
    `
      SELECT lead_filter_mode, ai_enabled, min_messages_before_create, allowlist_last10, denylist_last10
      FROM pendencias.crm_evolution_intake_settings
      WHERE id = 1
      LIMIT 1
    `
  );
  const row = res.rows?.[0] || {};
  const mode = String(
    row.lead_filter_mode || process.env.CRM_EVOLUTION_LEAD_FILTER_MODE || "BUSINESS_ONLY"
  )
    .trim()
    .toUpperCase();
  const aiEnabled =
    row.ai_enabled != null
      ? row.ai_enabled === true
      : String(process.env.CRM_EVOLUTION_INTAKE_AI_ENABLED || "true").toLowerCase() === "true";
  const minMessagesBeforeCreate = Math.max(
    1,
    Math.min(10, Number(row.min_messages_before_create || 2))
  );
  const allowlist = parseLast10ListFromEnv(
    row.allowlist_last10 || process.env.CRM_EVOLUTION_LEAD_ALLOWLIST_LAST10
  );
  const denylist = parseLast10ListFromEnv(
    row.denylist_last10 || process.env.CRM_EVOLUTION_LEAD_DENYLIST_LAST10
  );
  return { mode, aiEnabled, minMessagesBeforeCreate, allowlist, denylist };
}

async function upsertIntakeBuffer(pool: any, args: {
  inboxId: string;
  phoneLast10: string;
  phoneDigits: string;
  profileName: string | null;
  text: string;
  businessSignal: boolean;
}) {
  const res = await pool.query(
    `
      INSERT INTO pendencias.crm_evolution_intake_buffer (
        inbox_id, phone_last10, phone_digits, profile_name, message_count, sample_text, business_score,
        last_decision, first_seen_at, last_seen_at, updated_at
      )
      VALUES ($1::uuid, $2, $3, $4, 1, LEFT($5, 2000), $6, 'WAIT', NOW(), NOW(), NOW())
      ON CONFLICT (inbox_id, phone_last10) DO UPDATE
      SET
        phone_digits = EXCLUDED.phone_digits,
        profile_name = COALESCE(EXCLUDED.profile_name, pendencias.crm_evolution_intake_buffer.profile_name),
        message_count = pendencias.crm_evolution_intake_buffer.message_count + 1,
        sample_text = LEFT(
          COALESCE(pendencias.crm_evolution_intake_buffer.sample_text, '') || E'\n' || EXCLUDED.sample_text,
          2000
        ),
        business_score = pendencias.crm_evolution_intake_buffer.business_score + EXCLUDED.business_score,
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING id, message_count, sample_text, business_score
    `,
    [args.inboxId, args.phoneLast10, args.phoneDigits, args.profileName, args.text, args.businessSignal ? 1 : 0]
  );
  return res.rows?.[0] || null;
}

function hasBusinessSignals(input: { text: string; profileName: string | null; cteDetected: string | null }) {
  if (input.cteDetected) return true;
  const text = String(input.text || "").toLowerCase();
  const name = String(input.profileName || "").toLowerCase();
  const bag = `${text} ${name}`;
  const keywords = [
    "cte",
    "coleta",
    "entrega",
    "rastrei",
    "mercadoria",
    "nf",
    "nota fiscal",
    "romaneio",
    "cotacao",
    "cotação",
    "frete",
    "transport",
    "logistica",
    "logística",
    "ltda",
    "eireli",
    "mei",
    "agencia",
    "agência",
    "filial",
    "cliente",
    "embarque",
    "descarga",
  ];
  return keywords.some((k) => bag.includes(k));
}

async function findAgencyByLast10(pool: any, last10: string): Promise<{ id: string; name: string } | null> {
  const agRes = await pool.query(
    `
      SELECT id, name
      FROM pendencias.crm_agencies
      WHERE
        RIGHT(regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g'), 10) = $1
        OR RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [last10]
  );
  const row = agRes.rows?.[0];
  if (!row?.id) return null;
  return { id: String(row.id), name: String(row.name || "Agência") };
}

async function shouldCreateLeadForNewContact(input: {
  mode: string;
  isFromMe: boolean;
  isAgencyContact: boolean;
  allowlisted: boolean;
  denylisted: boolean;
  text: string;
  profileName: string | null;
  cteDetected: string | null;
  aiEnabled: boolean;
  minMessagesBeforeCreate: number;
  bufferedMessageCount: number;
  bufferedText: string;
  /** Mídia real (imagem, sticker, etc.) — não descartar no intake só por falta de palavra-chave. */
  hasInboundMedia: boolean;
}) {
  if (input.denylisted) return false;
  // fromMe precisa espelhar no CRM mesmo em primeiro contato.
  if (input.isFromMe) return true;
  if (input.hasInboundMedia) return true;
  if (input.allowlisted || input.isAgencyContact) return true;
  if (input.mode === "OFF") return true;
  if (input.mode === "AGENCY_ONLY") return false;
  // BUSINESS_ONLY (padrão): evita poluição por contatos pessoais.
  const basicSignal = hasBusinessSignals({
    text: input.text,
    profileName: input.profileName,
    cteDetected: input.cteDetected,
  });
  if (basicSignal) return true;
  if (input.bufferedMessageCount < input.minMessagesBeforeCreate) return false;
  const bufferedSignal = hasBusinessSignals({
    text: input.bufferedText,
    profileName: input.profileName,
    cteDetected: input.cteDetected,
  });
  if (bufferedSignal) return true;
  if (!input.aiEnabled) return false;
  const decision = await aiIntakeDecision([
    "Contexto: triagem de novo contato no CRM logístico.",
    "Responda apenas CREATE, WAIT ou SKIP.",
    `Mensagem atual: ${input.text}`,
    `Histórico curto: ${input.bufferedText}`,
    "Regra: CREATE só se parecer conversa de negócio (rastreio/cte/coleta/entrega/cotação/agência).",
  ].join("\n"));
  return decision === "CREATE";
}

function utf8BufEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Valida POST do Evolution. Aceita o mesmo segredo em:
 * - `?token=` na URL (trim)
 * - header `x-pendencias-evolution-token`
 * - `Authorization: Bearer …`
 * - campo JSON `apikey` (a Evolution envia em todo webhook; alinha com a URL quando o token da query vem errado em pedidos paralelos)
 */
function verifyEvolutionWebhook(req: Request, body: Record<string, unknown>): boolean {
  const secret = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (!secret) return !isProd;

  const candidates: string[] = [];
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("token");
    if (q != null && String(q).length) candidates.push(String(q).trim());
  } catch {
    /* ignore */
  }
  const h = req.headers.get("x-pendencias-evolution-token");
  if (h != null && String(h).length) candidates.push(String(h).trim());
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) candidates.push(t);
  }
  const bodyApi = body && typeof body === "object" ? (body as any).apikey : null;
  if (typeof bodyApi === "string" && bodyApi.trim()) candidates.push(bodyApi.trim());

  for (const c of candidates) {
    if (c && utf8BufEq(c, secret)) return true;
  }
  return false;
}

/**
 * GET só confirma que a URL existe. A Evolution manda eventos em POST.
 * Se EVOLUTION_WEBHOOK_TOKEN estiver no .env, este GET compara o ?token= da URL (teste no navegador).
 */
export async function GET(req: Request) {
  const secret = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  let tokenConfereComDotEnv: boolean | null = null;
  let tokenPresenteNaUrl = false;
  if (secret) {
    try {
      const q = new URL(req.url).searchParams.get("token");
      tokenPresenteNaUrl = q != null && String(q).length > 0;
      tokenConfereComDotEnv = tokenPresenteNaUrl && String(q).trim() === secret;
    } catch {
      tokenConfereComDotEnv = false;
    }
  }

  return NextResponse.json({
    ok: true,
    path: "/api/whatsapp/evolution/webhook",
    evolutionWebhookTokenDefinidoNoEnv: Boolean(secret),
    ...(secret
      ? {
          tokenPresenteNaUrl,
          tokenConfereComDotEnv,
        }
      : {}),
    hint: !secret
      ? "EVOLUTION_WEBHOOK_TOKEN vazio no .env: POST aceito sem token. Em produção defina o token."
      : !tokenPresenteNaUrl
        ? "Inclua ?token=VALOR_IGUAL_AO_ENV na URL para testar; POST sem token correto retorna 401."
        : tokenConfereComDotEnv
          ? "Token da URL confere com o .env. A Evolution ainda precisa enviar POST (eventos), não GET."
          : "Token na URL NÃO confere com EVOLUTION_WEBHOOK_TOKEN no .env — corrija ou POST falha com 401.",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

function normalizeEventName(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, ".")
    .replace(/-/g, ".");
}

/** Evento pode vir no body ou no path (Webhook por Eventos: …/webhook/QRCODE_UPDATED). */
function extractEvolutionEvent(req: Request, body: Record<string, unknown>): string {
  const fromBody =
    body?.event ?? body?.type ?? body?.eventName ?? body?.name ?? "";
  if (fromBody) return String(fromBody);
  try {
    const url = new URL(req.url);
    const segs = url.pathname.split("/").filter(Boolean);
    const wi = segs.lastIndexOf("webhook");
    if (wi >= 0 && segs[wi + 1]) {
      return decodeURIComponent(segs[wi + 1]);
    }
  } catch {
    /* ignore */
  }
  return "";
}

function extractEvolutionInstance(body: Record<string, unknown>): string {
  const d = body?.data as Record<string, unknown> | undefined;
  const raw =
    body?.instance ||
    body?.instanceName ||
    (body as any)?.instanceKey ||
    d?.instance ||
    d?.instanceName ||
    (d as any)?.instance_name ||
    (body as any)?.instance_name ||
    (d as any)?.key?.instance ||
    "";
  return String(raw || "").trim();
}

/** QRCODE_UPDATED → qrcode.updated; QR_CODE_UPDATED → qr.code.updated (antes não batia). */
function isQrcodeUpdatedEvent(eventNorm: string): boolean {
  if (!eventNorm) return false;
  if (eventNorm.includes("qrcode.updated")) return true;
  if (eventNorm.includes("qr") && eventNorm.includes("code") && eventNorm.includes("updated")) return true;
  return false;
}

/**
 * Evolution / Baileys envia o nome do evento em formatos variados:
 * MESSAGES_UPSERT → "messages.upsert", mas "messagesUpsert" vira "messagesupsert" (sem ponto)
 * e era ignorado pelo cheque antigo — mensagens nunca entravam no CRM.
 */
function looksLikeMessagesUpsert(body: Record<string, unknown>, eventNorm: string): boolean {
  if (!eventNorm) {
    /* continua para heurística no payload */
  } else if (
    eventNorm.includes("messages.upsert") ||
    (eventNorm.includes("messages") && eventNorm.includes("upsert"))
  ) {
    return true;
  } else if (
    eventNorm.includes("connection") ||
    eventNorm.includes("qrcode") ||
    eventNorm.includes("qr.code") ||
    eventNorm.includes("presence") ||
    eventNorm.includes("chats.") ||
    eventNorm.includes("contacts.")
  ) {
    return false;
  }
  const d = (body?.data ?? body) as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return false;
  if (Array.isArray(d.messages) && d.messages.length) return true;
  if (d.key && (d.message || (d as any).msg || d.messageType)) return true;
  return false;
}

function collectUpsertItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (data.key && (data.message || data.msg || data.messageType)) return [data];
  return [];
}

/** Algumas versões colocam mensagens só em body.data; outras ecoam na raiz. */
function collectUpsertItemsFromWebhookBody(body: Record<string, unknown>): any[] {
  const data = body?.data as Record<string, unknown> | undefined;
  const fromData = collectUpsertItems(data);
  if (fromData.length) return fromData;
  if (data && typeof data === "object") {
    const nested = collectUpsertItems((data as any).data);
    if (nested.length) return nested;
    const fromPayload = collectUpsertItems((data as any).payload);
    if (fromPayload.length) return fromPayload;
  }
  return collectUpsertItems(body);
}

function extractEvolutionQuotedMessageId(item: any): string | null {
  const m = item?.message || item?.msg || {};
  const candidates = [
    m?.extendedTextMessage?.contextInfo?.stanzaId,
    m?.imageMessage?.contextInfo?.stanzaId,
    m?.videoMessage?.contextInfo?.stanzaId,
    m?.documentMessage?.contextInfo?.stanzaId,
    m?.audioMessage?.contextInfo?.stanzaId,
    m?.stickerMessage?.contextInfo?.stanzaId,
    item?.contextInfo?.stanzaId,
  ];
  for (const c of candidates) {
    const id = String(c || "").trim();
    if (id) return id;
  }
  return null;
}

function collectMessageEditItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.messageUpdates)) return data.messageUpdates;
  if (data.key && (data.message || data.editedMessage || data.update)) return [data];
  return [];
}

function looksLikeMessageEditEvent(eventNorm: string): boolean {
  if (!eventNorm) return false;
  if (eventNorm.includes("messages.edited")) return true;
  if (eventNorm.includes("message.edited")) return true;
  return false;
}

function looksLikeMessagesDeleteEvent(eventNorm: string): boolean {
  if (!eventNorm) return false;
  if (eventNorm.includes("messages.delete")) return true;
  if (eventNorm.includes("message.delete")) return true;
  return false;
}

function looksLikeMessagesUpdateEvent(eventNorm: string): boolean {
  if (!eventNorm) return false;
  return eventNorm.includes("messages.update");
}

function collectMessageUpdateItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.messageUpdates)) return data.messageUpdates;
  if (Array.isArray(data.updates)) return data.updates;
  /** Evolution v2: um único objeto com keyId + status (sem key.messagem). */
  if (data.keyId || data.key || data.id || data.messageId) return [data];
  return [];
}

function normalizeOutboundStatus(rawStatus: unknown): string | null {
  const s = String(rawStatus || "").trim().toLowerCase();
  if (!s) return null;
  if (["pending", "queued", "sending", "sent", "delivered", "read", "played", "failed", "error"].includes(s)) {
    return s;
  }
  // ack comum de libs WhatsApp: -1 erro, 0 pendente, 1 enviado, 2 entregue, 3 lido, 4 reproduzido.
  const ackNum = Number(s);
  if (Number.isFinite(ackNum)) {
    if (ackNum <= -1) return "failed";
    if (ackNum === 0) return "pending";
    if (ackNum === 1) return "sent";
    if (ackNum === 2) return "delivered";
    if (ackNum === 3) return "read";
    if (ackNum >= 4) return "played";
  }
  if (s.includes("deliv")) return "delivered";
  if (s.includes("read")) return "read";
  if (s.includes("play")) return "played";
  if (s.includes("sent")) return "sent";
  if (s.includes("pend")) return "pending";
  if (s.includes("fail") || s.includes("error")) return "failed";
  return null;
}

function extractUpdateMessageId(item: any): string {
  return String(
    item?.key?.id ||
      item?.keyId ||
      item?.id ||
      item?.messageId ||
      item?.message_id ||
      item?.data?.key?.id ||
      item?.data?.keyId ||
      item?.data?.id ||
      ""
  ).trim();
}

function extractUpdateStatus(item: any): string | null {
  const raw =
    item?.status ??
    item?.ack ??
    item?.update?.status ??
    item?.update?.ack ??
    item?.data?.status ??
    item?.data?.ack ??
    item?.messageStatus ??
    item?.messageAck ??
    null;
  return normalizeOutboundStatus(raw);
}

function isDeliveredLikeStatus(status: string) {
  return status === "delivered" || status === "read" || status === "played";
}

function extractUpdateRemoteJid(item: any): string {
  return String(
    item?.remoteJid ||
      item?.key?.remoteJid ||
      item?.jid ||
      item?.data?.remoteJid ||
      item?.data?.key?.remoteJid ||
      ""
  ).trim();
}

function extractUpdateFromMe(item: any): boolean {
  return item?.fromMe === true || item?.key?.fromMe === true || item?.data?.fromMe === true;
}

/**
 * Antes: criava uma mensagem visível "📨 Atualização recebida do WhatsApp (fallback)…" no CRM,
 * o que poluía o chat (ex.: após apagar mensagem ou ack sem linha casando no UPDATE).
 * O status continua sendo aplicado só pelo UPDATE em processWebhookMessageStatusUpdates.
 */
async function persistStatusUpdateFallback(_args: {
  pool: any;
  instance: string;
  inboxId: string;
  waMessageId: string;
  remoteJid: string;
  status: string;
  fromMe: boolean;
  defaultIds: { pipelineId: string; stageId: string } | null;
}) {
  return { created: false, reason: "skip_silent_status_fallback" as const };
}

async function processWebhookMessageStatusUpdates(args: {
  pool: any;
  body: Record<string, unknown>;
  instance: string;
  inboxId: string;
  defaultIds: { pipelineId: string; stageId: string } | null;
}) {
  const { pool, body, instance, inboxId, defaultIds } = args;
  const items = collectMessageUpdateItems(body?.data);
  let applied = 0;
  let fallbackCreated = 0;
  const fallbackReasons: Record<string, number> = {};
  for (const item of items) {
    const waMessageId = extractUpdateMessageId(item);
    const status = extractUpdateStatus(item);
    if (!waMessageId || !status) continue;
    const patch = {
      status,
      delivered: isDeliveredLikeStatus(status),
      updated_at: new Date().toISOString(),
    };
    const res = await pool.query(
      `
        UPDATE pendencias.crm_messages
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{outbound_whatsapp}',
          COALESCE(COALESCE(metadata, '{}'::jsonb)->'outbound_whatsapp', '{}'::jsonb) || $1::jsonb,
          true
        )
        WHERE provider_message_id = $2
           OR metadata->>'message_id' = $2
           OR metadata#>>'{outbound_whatsapp,message_id}' = $2
      `,
      [JSON.stringify(patch), waMessageId]
    );
    const updated = Number(res.rowCount || 0);
    applied += updated;
    if (updated > 0) continue;
    const fallback = await persistStatusUpdateFallback({
      pool,
      instance,
      inboxId,
      waMessageId,
      remoteJid: extractUpdateRemoteJid(item),
      status,
      fromMe: extractUpdateFromMe(item),
      defaultIds,
    });
    if (fallback.created) fallbackCreated += 1;
    fallbackReasons[fallback.reason] = (fallbackReasons[fallback.reason] || 0) + 1;
  }
  return { applied, fallbackCreated, fallbackReasons, itemCount: items.length };
}

function hasRenderableEditInPayload(body: Record<string, unknown>): boolean {
  const items = collectMessageEditItems(body?.data);
  for (const item of items) {
    const inner = extractEditedInnerMessage(item);
    const t = extractEvolutionMessageText(inner);
    if (t && String(t).trim().length > 0) return true;
  }
  return false;
}

function extractEditedInnerMessage(item: any): any {
  if (!item || typeof item !== "object") return null;
  return (
    item.editedMessage?.message ||
    item.editedMessage ||
    item.message ||
    item.update?.message ||
    item.update?.editedMessage?.message ||
    item.update?.editedMessage ||
    null
  );
}

function collectMessageDeleteItems(data: any): { id: string }[] {
  const out: { id: string }[] = [];
  if (!data || typeof data !== "object") return out;
  if (data.all === true && data.jid) {
    console.warn("[evolution-webhook] messages.delete(all) ignorado (não limpamos o CRM inteiro)", {
      jid: String(data.jid).slice(0, 48),
    });
    return out;
  }
  const pushKey = (k: any) => {
    const id = String(k?.id || k?.key?.id || "").trim();
    if (id) out.push({ id });
  };
  if (Array.isArray(data.keys)) {
    for (const k of data.keys) pushKey(k?.key || k);
    return out;
  }
  if (Array.isArray(data)) {
    for (const k of data) pushKey(k?.key || k);
    return out;
  }
  if (data.key) {
    pushKey(data.key);
    return out;
  }
  const msgs = (data as any).messages;
  if (Array.isArray(msgs)) {
    for (const m of msgs) pushKey(m?.key || m);
  }
  return out;
}

async function processWebhookMessageDeletes(pool: any, body: Record<string, unknown>) {
  const items = collectMessageDeleteItems(body?.data);
  let applied = 0;
  for (const { id } of items) {
    applied += await applyCrmMessageDeleteByWaMessageId(pool, id);
  }
  return applied;
}

async function processWebhookMessageEdits(pool: any, body: Record<string, unknown>) {
  const items = collectMessageEditItems(body?.data);
  let applied = 0;
  for (const item of items) {
    const key = item?.key || item;
    const waMessageId = String(key?.id || "").trim();
    if (!waMessageId) continue;
    const inner = extractEditedInnerMessage(item);
    const newText = extractEvolutionMessageText(inner);
    if (!newText || !String(newText).trim()) continue;
    applied += await applyCrmMessageEditByWaMessageId(pool, waMessageId, newText);
  }
  return applied;
}

export async function POST(req: Request) {
  try {
    const reqUrl = (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return req.url;
      }
    })();
    const rawBody = await req.text().catch(() => "");
    let body: Record<string, unknown> = {};
    if (rawBody && String(rawBody).trim()) {
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    if (!verifyEvolutionWebhook(req, body)) {
      let hasQueryToken = false;
      let queryTokenMatches = false;
      let bodyApikeyMatches = false;
      const secret = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
      try {
        const u = new URL(req.url);
        const q = u.searchParams.get("token");
        hasQueryToken = q != null && String(q).length > 0;
        if (hasQueryToken && secret) queryTokenMatches = utf8BufEq(String(q).trim(), secret);
      } catch {
        /* ignore */
      }
      const ak = (body as any)?.apikey;
      if (typeof ak === "string" && ak.trim() && secret) bodyApikeyMatches = utf8BufEq(ak.trim(), secret);
      console.warn("[evolution-webhook] unauthorized", {
        path: reqUrl,
        hasQueryToken,
        queryTokenMatches,
        bodyHasApikey: typeof (body as any)?.apikey === "string" && String((body as any).apikey).length > 0,
        bodyApikeyMatches,
      });
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const instance = extractEvolutionInstance(body);
    const eventRaw = extractEvolutionEvent(req, body);
    const eventNorm = normalizeEventName(eventRaw);
    console.log("[evolution-webhook] hit", {
      path: reqUrl,
      eventRaw: eventRaw || null,
      eventNorm: eventNorm || null,
      instance: instance || null,
      bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
      dataKeys:
        body?.data && typeof body.data === "object" ? Object.keys(body.data as object) : [],
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[evolution-webhook] POST", {
        event: eventRaw || "(vazio)",
        instance: instance || "(vazio)",
      });
      if (eventNorm.includes("connection.update") && body?.data && typeof body.data === "object") {
        const ik = instance || "_";
        const now = Date.now();
        const last = lastConnectionDetailLogAt.get(ik) || 0;
        if (now - last > 8000) {
          lastConnectionDetailLogAt.set(ik, now);
          const d = body.data as Record<string, unknown>;
          console.log("[evolution-webhook] connection.update data", {
            keys: Object.keys(d),
            state: d.state ?? d.connection ?? null,
          });
        }
      }
    }

    // QR — GET /instance/connect costuma retornar { count: 0 }; webhook traz o base64.
    if (instance && isQrcodeUpdatedEvent(eventNorm)) {
      const qrStored =
        evolutionQrCaptureFromWebhook(instance, body?.data) || evolutionQrCaptureFromWebhook(instance, body);
      if (process.env.NODE_ENV === "development") {
        const d = body?.data;
        console.log("[evolution-webhook] QRCODE_UPDATED", {
          instance,
          eventRaw: eventRaw || null,
          qrStored,
          dataKeys: d && typeof d === "object" ? Object.keys(d as object) : typeof d,
        });
      }
      return NextResponse.json({ ok: true, qrStored });
    }
    // Payload com QR sem nome de evento confiável
    if (
      instance &&
      (evolutionQrCaptureFromWebhook(instance, body?.data) || evolutionQrCaptureFromWebhook(instance, body))
    ) {
      if (process.env.NODE_ENV === "development") {
        console.log("[evolution-webhook] QR capturado por payload (evento:", eventRaw || "vazio", ")");
      }
      return NextResponse.json({ ok: true, qrStored: true });
    }

    /** Mensagens editadas (MESSAGES_EDITED) ou updates com texto novo (evita flood de ACK de leitura). */
    const editRoute =
      looksLikeMessageEditEvent(eventNorm) ||
      (looksLikeMessagesUpdateEvent(eventNorm) && hasRenderableEditInPayload(body));

    if (editRoute) {
      await ensureCrmSchemaTables();
      const pool = getPool();
      if (!instance) {
        return NextResponse.json({ ok: false, error: "instance ausente" }, { status: 400 });
      }
      const inboxEditRes = await pool.query(
        `
          SELECT id
          FROM pendencias.crm_whatsapp_inboxes
          WHERE is_active = true
            AND provider = 'EVOLUTION'
            AND lower(btrim(evolution_instance_name)) = lower(btrim($1))
          LIMIT 1
        `,
        [instance]
      );
      if (!inboxEditRes.rows?.[0]?.id) {
        return NextResponse.json({ ok: true, skipped: "unknown_instance_for_edit" });
      }
      const applied = await processWebhookMessageEdits(pool, body);
      return NextResponse.json({ ok: true, message_edits_applied: applied });
    }

    if (looksLikeMessagesDeleteEvent(eventNorm)) {
      await ensureCrmSchemaTables();
      const pool = getPool();
      if (!instance) {
        return NextResponse.json({ ok: false, error: "instance ausente" }, { status: 400 });
      }
      const inboxDelRes = await pool.query(
        `
          SELECT id
          FROM pendencias.crm_whatsapp_inboxes
          WHERE is_active = true
            AND provider = 'EVOLUTION'
            AND lower(btrim(evolution_instance_name)) = lower(btrim($1))
          LIMIT 1
        `,
        [instance]
      );
      if (!inboxDelRes.rows?.[0]?.id) {
        return NextResponse.json({ ok: true, skipped: "unknown_instance_for_delete" });
      }
      const appliedDel = await processWebhookMessageDeletes(pool, body);
      return NextResponse.json({ ok: true, message_deletes_applied: appliedDel });
    }

    /** Updates de status/ack (MESSAGES_UPDATE): tira mensagens de "Enviando" no CRM. */
    if (looksLikeMessagesUpdateEvent(eventNorm)) {
      await ensureCrmSchemaTables();
      const pool = getPool();
      if (!instance) {
        return NextResponse.json({ ok: false, error: "instance ausente" }, { status: 400 });
      }
      const inboxUpdateRes = await pool.query(
        `
          SELECT id
          FROM pendencias.crm_whatsapp_inboxes
          WHERE is_active = true
            AND provider = 'EVOLUTION'
            AND lower(btrim(evolution_instance_name)) = lower(btrim($1))
          LIMIT 1
        `,
        [instance]
      );
      if (!inboxUpdateRes.rows?.[0]?.id) {
        console.warn("[evolution-webhook] status update ignored: unknown instance", { instance, eventNorm });
        return NextResponse.json({ ok: true, skipped: "unknown_instance_for_update" });
      }
      const defaultIds = await ensureDefaultPipelineAndFirstStage(pool);
      const result = await processWebhookMessageStatusUpdates({
        pool,
        body,
        instance,
        inboxId: String(inboxUpdateRes.rows[0].id),
        defaultIds,
      });
      console.log("[evolution-webhook] status updates applied", {
        instance,
        applied: result.applied,
        fallbackCreated: result.fallbackCreated,
        fallbackReasons: result.fallbackReasons,
        itemCount: result.itemCount,
      });
      if (!result.applied && !result.fallbackCreated) {
        const items = collectMessageUpdateItems((body as any)?.data);
        const sample = (items || []).slice(0, 3).map((it: any) => ({
          keyId: String(it?.keyId || it?.key?.id || it?.messageId || "").slice(0, 40),
          fromMe: !!it?.fromMe,
          remoteJid: String(it?.remoteJid || it?.key?.remoteJid || "").slice(0, 40),
          status: String(it?.status ?? it?.ack ?? ""),
        }));
        console.warn("[evolution-webhook] status_update_without_match", { instance, count: items.length, sample });
      }
      return NextResponse.json({
        ok: true,
        message_updates_applied: result.applied,
        message_updates_fallback_created: result.fallbackCreated,
      });
    }

    // Só messages.upsert precisa de inbox no CRM — demais eventos não consultam DB (evita log enganoso e ~15s).
    if (!looksLikeMessagesUpsert(body, eventNorm)) {
      console.log("[evolution-webhook] ignored event", { instance, eventRaw, eventNorm });
      return NextResponse.json({ ok: true, ignored_event: eventRaw || null });
    }

    const upsertProbe = collectUpsertItemsFromWebhookBody(body);
    if (!upsertProbe.length && process.env.NODE_ENV !== "test") {
      console.warn("[evolution-webhook] evento parece upsert mas sem itens de mensagem", {
        instance,
        eventRaw,
        eventNorm,
        bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
        dataKeys:
          body?.data && typeof body.data === "object" ? Object.keys(body.data as object) : [],
      });
    }

    await ensureCrmSchemaTables();
    const pool = getPool();

    if (!instance) {
      return NextResponse.json({ ok: false, error: "instance ausente" }, { status: 400 });
    }

    const inboxRes = await pool.query(
      `
        SELECT id, name, evolution_server_url, evolution_api_key
        FROM pendencias.crm_whatsapp_inboxes
        WHERE is_active = true
          AND provider = 'EVOLUTION'
          AND lower(btrim(evolution_instance_name)) = lower(btrim($1))
        LIMIT 1
      `,
      [instance]
    );
    const inboxRow = inboxRes.rows?.[0];
    if (!inboxRow?.id) {
      console.warn(
        "[evolution-webhook] Inbox não cadastrada para instance:",
        instance,
        "— confira evolution_instance_name no CRM (diferença 0/O ou hífen costuma causar isso)."
      );
      return NextResponse.json({ ok: true, skipped: "unknown_instance", instance });
    }
    const inboxId = String(inboxRow.id);

    const items = collectUpsertItemsFromWebhookBody(body);
    console.log("[evolution-webhook] upsert items", { instance, count: items.length });
    if (!items.length) {
      return NextResponse.json({ ok: true, empty: true, hint: "payload_sem_messages" });
    }

    const defaultIds = await ensureDefaultPipelineAndFirstStage(pool);
    if (!defaultIds) {
      return NextResponse.json({ error: "Funil CRM não disponível" }, { status: 500 });
    }

    const intakeSettings = await loadIntakeSettings(pool);

    for (const item of items) {
      let intakeReplayPayload: { sampleText: string; currentText: string } | null = null;
      const key = item?.key || item;
      if (!key) {
        logUpsertSkip("missing_key", {
          instance,
          itemKeys: item && typeof item === "object" ? Object.keys(item as object) : [],
        });
        continue;
      }
      const isFromMe = key.fromMe === true;

      const remoteJid = String(key.remoteJid || key.remoteJidAlt || "").trim();
      if (!remoteJid) {
        logUpsertSkip("skip_jid", { instance, remoteJid: "" });
        continue;
      }
      if (remoteJid.includes("@g.us")) {
        console.info("[evolution-webhook] skip_group_chat", {
          instance,
          hint: "Grupos não entram no CRM (comportamento esperado).",
        });
        continue;
      }
      if (remoteJid.includes("status@broadcast") || remoteJid.includes("@broadcast")) {
        logUpsertSkip("skip_broadcast", { instance, remoteJid: remoteJid.slice(0, 48) });
        continue;
      }

      const phoneDigits = evolutionNumberDigits(remoteJid);
      if (!phoneDigits) {
        logUpsertSkip("no_phone_digits", { instance, remoteJid: remoteJid.slice(0, 48) });
        continue;
      }

      const msgObj = item.message || item.msg || {};
      const msgId = String(key.id || "");
      const inboundMediaSlotCount = countEvolutionInboundMediaSlots(item, msgId || "x");
      const unwrappedMsg = unwrapEvolutionInner(msgObj) || msgObj;
      // Alguns provedores enviam tipo/mídia fora de message; usa fallback com o item inteiro.
      const tMsg = extractEvolutionMessageText(msgObj) || "";
      const tUnwrap = extractEvolutionMessageText(unwrappedMsg) || "";
      const tItem = extractEvolutionMessageText(item) || "";
      let text = preferEvolutionInboundBody(tMsg, tUnwrap, tItem);
      const mtHint = bodyTextFromEvolutionMessageTypeHint(evolutionWebhookRootMessageType(item));
      if (mtHint && rankEvolutionBodyLabel(mtHint) > rankEvolutionBodyLabel(text)) {
        text = mtHint;
      }
      const textLooksLikeInboundMedia = /^\[(Imagem recebida|Figurinha recebida|Vídeo recebido|Documento recebido|Áudio recebido)\]$/i.test(
        String(text || "").trim()
      );
      const hasInboundMediaForIntake =
        inboundMediaSlotCount > 0 ||
        textLooksLikeInboundMedia ||
        Boolean(mtHint);
      const cteDetected = extractCteFromText(text);
      const last10 = lastN(phoneDigits, 10);
      const titlePhoneSuffix = crmPhoneSuffixForTitle(phoneDigits);
      const profileNameRaw = extractProfileNameFromEvolutionItem(item);
      let profilePhotoUrl = extractProfilePhotoUrl(item);
      if (
        !profilePhotoUrl &&
        inboxRow.evolution_server_url &&
        inboxRow.evolution_api_key
      ) {
        profilePhotoUrl =
          (await evolutionFetchProfilePictureUrl({
            serverUrl: String(inboxRow.evolution_server_url),
            apiKey: String(inboxRow.evolution_api_key),
            instanceName: instance,
            number: remoteJid,
          })) ||
          (await evolutionFetchProfilePictureUrl({
            serverUrl: String(inboxRow.evolution_server_url),
            apiKey: String(inboxRow.evolution_api_key),
            instanceName: instance,
            number: phoneDigits,
          }));
      }
      // Em mensagens de saída (fromMe), alguns payloads trazem o nome do próprio atendente.
      // Nesses casos, não usamos esse valor para nome do lead.
      const profileName = isFromMe ? null : profileNameRaw;
      const quotedMessageId = extractEvolutionQuotedMessageId(item);
      const agencyContact = await findAgencyByLast10(pool, last10);

      const existingLead = await getOrMergeLeadByPhoneLast10(pool, last10);

      let resolvedReplyTo: { messageId?: string; sender?: string; text?: string } | null = null;
      if (quotedMessageId) {
        const refRes = await pool.query(
          `
            SELECT id, sender_type, body
            FROM pendencias.crm_messages
            WHERE metadata->>'message_id' = $1
               OR metadata#>>'{outbound_whatsapp,message_id}' = $1
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [quotedMessageId]
        );
        const ref = refRes.rows?.[0];
        if (ref?.id) {
          const senderType = String(ref.sender_type || "").toUpperCase();
          resolvedReplyTo = {
            messageId: String(ref.id),
            sender: senderType === "AGENT" ? "AGENTE" : senderType === "IA" ? "IA" : "CLIENTE",
            text: String(ref.body || "").slice(0, 280),
          };
        } else {
          resolvedReplyTo = {
            messageId: quotedMessageId,
            sender: "Mensagem",
            text: "Mensagem original",
          };
        }
      }

      let leadId: string;
      let leadTitle: string;

      if (existingLead?.id) {
        leadId = String(existingLead.id);
        leadTitle = String(existingLead.title || leadId);
        const titleEndsWithPhoneSuffix =
          leadTitle.endsWith(`(${last10})`) || leadTitle.endsWith(`(${titlePhoneSuffix})`);
        const titleNamePart = titleEndsWithPhoneSuffix
          ? crmStripTrailingTitlePhone(leadTitle)
          : leadTitle.trim();
        const normalizedTitleName = titleNamePart.toLowerCase();
        const normalizedProfileName = String(profileName || "").trim().toLowerCase();
        const titleLooksGeneric =
          /^whatsapp(\s|$)/i.test(leadTitle) ||
          /^contato web(\s|$)/i.test(leadTitle) ||
          /^unknown(\s|$)/i.test(leadTitle) ||
          /^sem nome(\s|$)/i.test(leadTitle);
        const shouldRefreshLeadTitle =
          !!profileName &&
          !isFromMe &&
          (titleLooksGeneric || (titleEndsWithPhoneSuffix && normalizedTitleName !== normalizedProfileName));
        if (shouldRefreshLeadTitle) {
          const upgradedTitle = `${profileName} (${titlePhoneSuffix})`;
          await pool.query(`UPDATE pendencias.crm_leads SET title = $1, updated_at = NOW() WHERE id = $2`, [
            upgradedTitle,
            leadId,
          ]);
          leadTitle = upgradedTitle;
        } else {
          const parenMatch = leadTitle.match(/\((\d+)\)\s*$/);
          const parenDigits = parenMatch?.[1] || "";
          if (
            phoneDigits.startsWith("55") &&
            phoneDigits.length >= 12 &&
            titlePhoneSuffix.length === 11 &&
            parenDigits &&
            parenDigits !== titlePhoneSuffix
          ) {
            const namePart = crmStripTrailingTitlePhone(leadTitle);
            if (namePart) {
              const fixedTitle = `${namePart} (${titlePhoneSuffix})`;
              if (fixedTitle !== leadTitle) {
                await pool.query(`UPDATE pendencias.crm_leads SET title = $1, updated_at = NOW() WHERE id = $2`, [
                  fixedTitle,
                  leadId,
                ]);
                leadTitle = fixedTitle;
              }
            }
          }
        }
        if (profilePhotoUrl && String(existingLead.contact_avatar_url || "").trim() !== profilePhotoUrl) {
          await pool.query(
            `UPDATE pendencias.crm_leads SET contact_avatar_url = $1, updated_at = NOW() WHERE id = $2`,
            [profilePhotoUrl, leadId]
          );
        }
      } else {
        const allowlisted = intakeSettings.allowlist.has(last10);
        const denylisted = intakeSettings.denylist.has(last10);
        const preSignal = hasBusinessSignals({
          text,
          profileName,
          cteDetected,
        });
        const bufferRow = await upsertIntakeBuffer(pool, {
          inboxId,
          phoneLast10: last10,
          phoneDigits,
          profileName,
          text,
          businessSignal: preSignal,
        });
        const shouldCreate = await shouldCreateLeadForNewContact({
          mode: intakeSettings.mode,
          isFromMe,
          isAgencyContact: !!agencyContact,
          allowlisted,
          denylisted,
          text,
          profileName,
          cteDetected,
          aiEnabled: intakeSettings.aiEnabled,
          minMessagesBeforeCreate: intakeSettings.minMessagesBeforeCreate,
          bufferedMessageCount: Number(bufferRow?.message_count || 1),
          bufferedText: String(bufferRow?.sample_text || text),
          hasInboundMedia: hasInboundMediaForIntake,
        });
        if (!shouldCreate) {
          await pool.query(
            `
              UPDATE pendencias.crm_evolution_intake_buffer
              SET last_decision = 'WAIT', updated_at = NOW()
              WHERE inbox_id = $1::uuid AND phone_last10 = $2
            `,
            [inboxId, last10]
          );
          logUpsertSkip("intake_wait", {
            instance,
            last10,
            phone: phoneDigits,
            mode: intakeSettings.mode,
            messageCount: Number(bufferRow?.message_count || 0),
            hasCte: !!cteDetected,
            profileName: profileName || null,
          });
          continue;
        }

        intakeReplayPayload = {
          sampleText: String(bufferRow?.sample_text || ""),
          currentText: text,
        };

        leadTitle = profileName
          ? `${profileName} (${titlePhoneSuffix})`
          : `WhatsApp (${titlePhoneSuffix})`;

        const positionRow = await pool.query(
          `
            SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
            FROM pendencias.crm_leads
            WHERE pipeline_id = $1 AND stage_id = $2
          `,
          [defaultIds.pipelineId, defaultIds.stageId]
        );
        const position = Number(positionRow.rows?.[0]?.next_pos || 0);

        const insertLead = await pool.query(
          `
            INSERT INTO pendencias.crm_leads (
              pipeline_id, stage_id, title, contact_phone, cte_number, cte_serie,
              frete_value, source, priority, current_location, owner_username, position,
              agency_id, contact_avatar_url, created_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,NULL,NULL,$6,'MEDIA',NULL,NULL,$7,$8::uuid,$9,NOW(),NOW())
            RETURNING id
          `,
          [
            defaultIds.pipelineId,
            defaultIds.stageId,
            leadTitle,
            phoneDigits,
            cteDetected || null,
            agencyContact ? "AGENCIA_WHATSAPP_WEB" : "WHATSAPP_WEB",
            position,
            agencyContact?.id || null,
            profilePhotoUrl,
          ]
        );
        leadId = insertLead.rows?.[0]?.id as string;
        await pool.query(
          `
            UPDATE pendencias.crm_evolution_intake_buffer
            SET
              last_decision = 'CREATED',
              created_lead_id = $3::uuid,
              updated_at = NOW()
            WHERE inbox_id = $1::uuid AND phone_last10 = $2
          `,
          [inboxId, last10, leadId]
        );

        await pool.query(
          `
            INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
            VALUES ($1, NULL, 'EVENT', $2, '{}'::jsonb, NOW())
          `,
          [leadId, `Lead criado via WhatsApp Web (${inboxRow.name || instance}: ${phoneDigits})`]
        );
      }

      let conversationId: string;
      let isNewConversation = false;
      const mergedConversationId = await getOrMergeWhatsappConversationByLead(pool, leadId, inboxId);
      if (mergedConversationId) {
        conversationId = mergedConversationId;
      } else {
        isNewConversation = true;
        const inboxDefault = await resolveInboxDefaultAssignment({
          inboxId,
          conversationId: `${leadId}:${inboxId}`,
        });
        const insertConv = await pool.query(
          `
            INSERT INTO pendencias.crm_conversations (
              lead_id, channel, is_active, created_at, last_message_at, whatsapp_inbox_id,
              assigned_username, assigned_team_id, assignment_mode
            )
            VALUES ($1, 'WHATSAPP', true, NOW(), NULL, $2::uuid, $3, $4::uuid, 'AUTO')
            RETURNING id
          `,
          [leadId, inboxId, inboxDefault.assignedUsername, inboxDefault.assignedTeamId]
        );
        conversationId = insertConv.rows?.[0]?.id as string;
        if (inboxDefault.assignedUsername) {
          await pool.query(
            `
              UPDATE pendencias.crm_leads
              SET assigned_username = COALESCE(assigned_username, $1),
                  assigned_team_id = COALESCE(assigned_team_id, $2::uuid),
                  owner_username = COALESCE(owner_username, $1),
                  updated_at = NOW()
              WHERE id = $3::uuid
            `,
            [inboxDefault.assignedUsername, inboxDefault.assignedTeamId, leadId]
          );
        } else if (inboxDefault.assignedTeamId) {
          await pool.query(
            `
              UPDATE pendencias.crm_leads
              SET assigned_team_id = COALESCE(assigned_team_id, $1::uuid), updated_at = NOW()
              WHERE id = $2::uuid
            `,
            [inboxDefault.assignedTeamId, leadId]
          );
        }
      }

      if (intakeReplayPayload) {
        const replayBody = buildPriorIntakeReplayBody(
          intakeReplayPayload.sampleText,
          intakeReplayPayload.currentText
        );
        if (replayBody) {
          const trimmed = replayBody.slice(0, 8000);
          await pool.query(
            `
              INSERT INTO pendencias.crm_messages (
                conversation_id, sender_type, body, has_attachments, metadata, created_at
              )
              VALUES ($1, 'CLIENT', $2, false, $3::jsonb, NOW())
            `,
            [
              conversationId,
              trimmed,
              JSON.stringify({
                provider: "EVOLUTION",
                evolution_instance: instance,
                intake_buffer_replay: true,
                remote_jid: remoteJid,
              }),
            ]
          );
          await pool.query(`UPDATE pendencias.crm_conversations SET last_message_at = NOW() WHERE id = $1`, [
            conversationId,
          ]);
        }
      }

      const legacyNonTextKeys =
        unwrappedMsg &&
        typeof unwrappedMsg === "object" &&
        Object.keys(unwrappedMsg).some(
          (k) =>
            ![
              "conversation",
              "extendedTextMessage",
              "messageContextInfo",
              "senderKeyDistributionMessage",
              "stickerMessage",
              "lottieStickerMessage",
            ].includes(k)
        );
      /** Inclui rótulo [Imagem recebida] etc. quando o proto vem vazio mas `messageType` já indica mídia (ingest usa key-only na Evolution). */
      const hasMedia =
        inboundMediaSlotCount > 0 || Boolean(legacyNonTextKeys) || textLooksLikeInboundMedia;
      if (msgId) {
        const dup = await pool.query(
          `
            SELECT m.id, m.body, m.has_attachments,
              (SELECT COUNT(*)::int FROM pendencias.crm_message_media mm WHERE mm.message_id = m.id) AS media_n
            FROM pendencias.crm_messages m
            WHERE (m.provider = 'EVOLUTION' AND m.provider_message_id = $1)
               OR m.metadata->>'message_id' = $1
               OR m.metadata#>>'{outbound_whatsapp,message_id}' = $1
            LIMIT 1
          `,
          [msgId]
        );
        const dupRow = dup.rows?.[0];
        if (dupRow?.id) {
          const existingId = String(dupRow.id);
          const existingBody = String(dupRow.body || "").trim();
          const existingMediaN = Number(dupRow.media_n || 0);
          const existingRank = rankEvolutionBodyLabel(existingBody);
          const newRank = rankEvolutionBodyLabel(text);
          const bodyIsGeneric =
            !existingBody ||
            existingBody.toLowerCase() === "[mensagem recebida]" ||
            existingBody.toLowerCase() === "[mensagem sem texto]";
          const shouldEnrich =
            (inboundMediaSlotCount > 0 && existingMediaN === 0) ||
            (hasMedia && existingMediaN === 0 && !dupRow.has_attachments) ||
            (bodyIsGeneric && newRank > existingRank);
          if (shouldEnrich) {
            const nextBody = preferEvolutionInboundBody(existingBody, text).slice(0, 8000);
            await pool.query(
              `
                UPDATE pendencias.crm_messages
                SET body = $2, has_attachments = has_attachments OR $3::boolean
                WHERE id = $1::uuid
              `,
              [existingId, nextBody, hasMedia]
            );
            if (hasMedia && inboxRow.evolution_server_url && inboxRow.evolution_api_key) {
              void ingestEvolutionInboundMedia({
                pool,
                messageId: existingId,
                conversationId,
                evolutionItem: item,
                serverUrl: String(inboxRow.evolution_server_url),
                apiKey: String(inboxRow.evolution_api_key),
                instanceName: instance,
                providerMessageId: msgId || null,
              }).catch((e) => console.error("[crm-media] evolution_async_dup", e));
            }
            console.info("[evolution-webhook] duplicate_message_enriched", {
              instance,
              msgId: msgId.slice(0, 32),
              slots: inboundMediaSlotCount,
              hadMediaRows: existingMediaN,
            });
          } else {
            logUpsertSkip("duplicate_evolution_message_id", {
              instance,
              msgId: msgId.slice(0, 32),
              conversationId,
            });
          }
          continue;
        }
      }

      const insEv = await pool.query(
        `
          INSERT INTO pendencias.crm_messages (
            conversation_id, sender_type, provider, provider_message_id, body, has_attachments, metadata, created_at
          )
          VALUES ($1, $2, 'EVOLUTION', $3, $4, $5, $6::jsonb, NOW())
          RETURNING id
        `,
        [
          conversationId,
          isFromMe ? "AGENT" : "CLIENT",
          msgId || null,
          text,
          hasMedia,
          JSON.stringify({
            provider: "EVOLUTION",
            evolution_instance: instance,
            message_id: msgId,
            from_me: isFromMe,
            sender_label: isFromMe ? "Sistema/Empresa" : "Cliente",
            remote_jid: remoteJid,
            ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
            raw: item,
          }),
        ]
      );
      const newEvMessageId = String(insEv.rows?.[0]?.id || "");
      if (newEvMessageId && hasMedia && inboxRow.evolution_server_url && inboxRow.evolution_api_key) {
        void ingestEvolutionInboundMedia({
          pool,
          messageId: newEvMessageId,
          conversationId,
          evolutionItem: item,
          serverUrl: String(inboxRow.evolution_server_url),
          apiKey: String(inboxRow.evolution_api_key),
          instanceName: instance,
          providerMessageId: msgId || null,
        }).catch((e) => console.error("[crm-media] evolution_async", e));
      }

      await pool.query(`UPDATE pendencias.crm_conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);

      await pool.query(
        `
          INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
          VALUES ($1, NULL, 'EVENT', $2, $3::jsonb, NOW())
        `,
        [
          leadId,
          isFromMe ? "Mensagem enviada fora do CRM (WhatsApp Web)" : "Mensagem recebida (WhatsApp Web)",
          JSON.stringify({ inbox: instance, from: phoneDigits }),
        ]
      );

      if (cteDetected) {
        await pool.query(
          `
            UPDATE pendencias.crm_leads
            SET cte_number = $1, updated_at = NOW()
            WHERE id = $2::uuid
          `,
          [String(cteDetected).trim(), leadId]
        );
      }

      if (!isFromMe && isNewConversation) {
        try {
          await applyInboundRouting({
            leadId,
            conversationId,
            text,
            title: leadTitle,
            cte: cteDetected,
          });
        } catch (e) {
          console.error("[evolution-webhook] applyInboundRouting:", e);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Evolution webhook error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
