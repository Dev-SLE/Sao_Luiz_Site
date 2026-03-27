import { NextResponse } from "next/server";
import { getPool } from "../../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../../lib/server/ensureSchema";
import { applyInboundRouting } from "../../../../../lib/server/crmRouting";
import { ensureDefaultPipelineAndFirstStage } from "../../../../../lib/server/crmDefaultPipeline";
import { evolutionNumberDigits, extractEvolutionMessageText } from "../../../../../lib/server/evolutionClient";
import { evolutionQrCaptureFromWebhook } from "../../../../../lib/server/evolutionLastQr";

export const runtime = "nodejs";

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

function verifyEvolutionWebhook(req: Request): boolean {
  const secret = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  if (!secret) return true;
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("token");
    const h = req.headers.get("x-pendencias-evolution-token");
    return q === secret || h === secret;
  } catch {
    return false;
  }
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

/** QRCODE_UPDATED → qrcode.updated; QR_CODE_UPDATED → qr.code.updated (antes não batia). */
function isQrcodeUpdatedEvent(eventNorm: string): boolean {
  if (!eventNorm) return false;
  if (eventNorm.includes("qrcode.updated")) return true;
  if (eventNorm.includes("qr") && eventNorm.includes("code") && eventNorm.includes("updated")) return true;
  return false;
}

function looksLikeMessagesUpsert(body: Record<string, unknown>, eventNorm: string): boolean {
  if (eventNorm.includes("messages.upsert")) return true;
  if (eventNorm) return false;
  const d = body?.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return false;
  if (Array.isArray(d.messages) && d.messages.length) return true;
  if (d.key && d.message) return true;
  return false;
}

function collectUpsertItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (data.key) return [data];
  return [];
}

export async function POST(req: Request) {
  try {
    if (!verifyEvolutionWebhook(req)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const instance = String(body?.instance || body?.instanceName || "").trim();
    const eventRaw = extractEvolutionEvent(req, body);
    const eventNorm = normalizeEventName(eventRaw);

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

    // Só messages.upsert precisa de inbox no CRM — demais eventos não consultam DB (evita log enganoso e ~15s).
    if (!looksLikeMessagesUpsert(body, eventNorm)) {
      return NextResponse.json({ ok: true, ignored_event: eventRaw || null });
    }

    await ensureCrmSchemaTables();
    const pool = getPool();

    if (!instance) {
      return NextResponse.json({ ok: false, error: "instance ausente" }, { status: 400 });
    }

    const inboxRes = await pool.query(
      `
        SELECT id, name
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
      console.warn("[evolution-webhook] Inbox não cadastrada para instance:", instance);
      return NextResponse.json({ ok: true, skipped: "unknown_instance" });
    }
    const inboxId = String(inboxRow.id);

    const items = collectUpsertItems(body?.data);
    if (!items.length) {
      return NextResponse.json({ ok: true, empty: true });
    }

    const defaultIds = await ensureDefaultPipelineAndFirstStage(pool);
    if (!defaultIds) {
      return NextResponse.json({ error: "Funil CRM não disponível" }, { status: 500 });
    }

    for (const item of items) {
      const key = item?.key || item;
      if (!key || key.fromMe === true) continue;

      const remoteJid = String(key.remoteJid || key.remoteJidAlt || "").trim();
      if (!remoteJid || remoteJid.includes("@g.us")) continue;
      if (remoteJid.includes("status@broadcast") || remoteJid.includes("@broadcast")) continue;

      const phoneDigits = evolutionNumberDigits(remoteJid);
      if (!phoneDigits) continue;

      const msgObj = item.message || item.msg || {};
      const text = extractEvolutionMessageText(msgObj) || "[Mensagem sem texto]";
      const cteDetected = extractCteFromText(text);
      const last10 = lastN(phoneDigits, 10);
      const pushName = String(item.pushName || item.verifiedBizName || "").trim();
      const profileName = pushName || null;

      const leadRes = await pool.query(
        `
          SELECT id, title, contact_phone
          FROM pendencias.crm_leads
          WHERE contact_phone IS NOT NULL
            AND RIGHT(regexp_replace(contact_phone, '\\D', '', 'g'), 10) = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [last10]
      );

      let leadId: string;
      let leadTitle: string;

      if (leadRes.rows?.[0]?.id) {
        leadId = leadRes.rows[0].id as string;
        leadTitle = String(leadRes.rows[0].title || leadId);
        if (profileName && /^whatsapp\s+\d+/i.test(leadTitle)) {
          const upgradedTitle = `${profileName} (${last10})`;
          await pool.query(`UPDATE pendencias.crm_leads SET title = $1, updated_at = NOW() WHERE id = $2`, [
            upgradedTitle,
            leadId,
          ]);
          leadTitle = upgradedTitle;
        }
      } else {
        leadTitle = profileName
          ? `${profileName} (${last10})`
          : `WhatsApp ${last10}`;

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
              frete_value, source, priority, current_location, owner_username, position, created_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,NULL,NULL,'WHATSAPP_WEB','MEDIA',NULL,NULL,$6,NOW(),NOW())
            RETURNING id
          `,
          [defaultIds.pipelineId, defaultIds.stageId, leadTitle, phoneDigits, cteDetected || null, position]
        );
        leadId = insertLead.rows?.[0]?.id as string;

        await pool.query(
          `
            INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
            VALUES ($1, NULL, 'EVENT', $2, '{}'::jsonb, NOW())
          `,
          [leadId, `Lead criado via WhatsApp Web (${inboxRow.name || instance}: ${phoneDigits})`]
        );
      }

      const convRes = await pool.query(
        `
          SELECT id
          FROM pendencias.crm_conversations
          WHERE lead_id = $1 AND channel = 'WHATSAPP' AND is_active = true
            AND whatsapp_inbox_id = $2::uuid
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [leadId, inboxId]
      );

      let conversationId: string;
      if (convRes.rows?.[0]?.id) {
        conversationId = convRes.rows[0].id as string;
      } else {
        const insertConv = await pool.query(
          `
            INSERT INTO pendencias.crm_conversations (lead_id, channel, is_active, created_at, last_message_at, whatsapp_inbox_id)
            VALUES ($1, 'WHATSAPP', true, NOW(), NULL, $2::uuid)
            RETURNING id
          `,
          [leadId, inboxId]
        );
        conversationId = insertConv.rows?.[0]?.id as string;
      }

      const hasMedia = msgObj && Object.keys(msgObj).some((k) => !["conversation", "extendedTextMessage"].includes(k));
      const msgId = String(key.id || "");

      await pool.query(
        `
          INSERT INTO pendencias.crm_messages (
            conversation_id, sender_type, body, has_attachments, metadata, created_at
          )
          VALUES ($1, 'CLIENT', $2, $3, $4::jsonb, NOW())
        `,
        [
          conversationId,
          text,
          hasMedia,
          JSON.stringify({
            provider: "EVOLUTION",
            evolution_instance: instance,
            message_id: msgId,
            remote_jid: remoteJid,
            raw: item,
          }),
        ]
      );

      await pool.query(`UPDATE pendencias.crm_conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);

      await pool.query(
        `
          INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
          VALUES ($1, NULL, 'EVENT', 'Mensagem recebida (WhatsApp Web)', $2::jsonb, NOW())
        `,
        [leadId, JSON.stringify({ inbox: instance, from: phoneDigits })]
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Evolution webhook error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
