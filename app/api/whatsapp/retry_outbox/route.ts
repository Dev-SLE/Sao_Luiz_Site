import { NextResponse } from "next/server";
import { requireApiPermissions, verifyCronSecret } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import {
  evolutionSendMedia,
  evolutionSendText,
  evolutionSendWhatsAppAudio,
  extractEvolutionOutboundWaMessageId,
} from "../../../../lib/server/evolutionClient";
import { getFileById } from "../../../../modules/storage/fileService";
import { getItemContentResponse } from "../../../../lib/server/sharepointGraph";
import { runWebhookSofiaAutoReply } from "../webhook/route";

export const runtime = "nodejs";

function normalizePhoneToE164(phoneRaw: string | null | undefined) {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function evolutionMediatypeFromMime(mime: string): "image" | "video" | "audio" | "document" {
  const m = String(mime || "").toLowerCase();
  if (m.includes("webp")) return "image";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}

async function readFileBufferFromCatalog(
  pool: any,
  fileId: string
): Promise<{ buffer: Buffer; mime: string; name: string } | null> {
  const file = await getFileById(pool, fileId);
  if (!file?.sharepoint_item_id || !file.sharepoint_site_id || !file.sharepoint_drive_id) return null;
  const res = await getItemContentResponse(file.sharepoint_site_id, file.sharepoint_drive_id, file.sharepoint_item_id);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = String(file.mime_type || res.headers.get("content-type") || "application/octet-stream");
  const name = String(file.original_name || file.file_name || "arquivo");
  return { buffer, mime, name };
}

async function sendWhatsAppText(args: { toE164: string; body: string }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      error: "WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado",
      response: null as any,
    };
  }

  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: args.toE164,
    type: "text",
    text: { preview_url: false, body: args.body },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        ok: false,
        error: (json as any)?.error?.message || `Erro HTTP ${resp.status}`,
        response: json,
      };
    }
    return { ok: true, error: null as string | null, response: json };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), response: null as any };
  }
}

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS"]);
      if (guard.denied) return guard.denied;
    }

    await ensureCrmSchemaTables();
    const pool = getPool();

    const lockOwner = `retry-worker:${process.pid}:${Date.now()}`;
    await pool.query("BEGIN");
    const jobsRes = await pool.query(
      `
        WITH picked AS (
          SELECT id
          FROM pendencias.crm_outbox
          WHERE status = 'PENDING'
            AND next_attempt_at <= NOW()
          ORDER BY created_at ASC
          LIMIT 25
          FOR UPDATE SKIP LOCKED
        )
        UPDATE pendencias.crm_outbox o
        SET
          status = 'PROCESSING',
          lock_owner = $1,
          processing_started_at = NOW(),
          updated_at = NOW()
        FROM picked
        WHERE o.id = picked.id
        RETURNING o.id, o.message_id, o.conversation_id, o.payload, o.attempts, o.channel
      `,
      [lockOwner]
    );
    await pool.query("COMMIT");
    const jobs = jobsRes.rows || [];

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      processed += 1;
      const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : (job.payload || {});
      const body = String(payload?.body || "");
      const conversationId = String(job.conversation_id || "");
      const attempts = Number(job.attempts || 0);
      const channel = String(job.channel || "WHATSAPP").toUpperCase();
      const payloadAttachments = Array.isArray(payload?.attachments) ? payload.attachments : [];

      const leadRes = await pool.query(
        `
          SELECT l.contact_phone
          FROM pendencias.crm_conversations c
          JOIN pendencias.crm_leads l ON l.id = c.lead_id
          WHERE c.id = $1
          LIMIT 1
        `,
        [conversationId]
      );
      const toE164 = normalizePhoneToE164(leadRes.rows?.[0]?.contact_phone);

      const hasRetryBodyOrMedia = body.length > 0 || payloadAttachments.length > 0;
      if (channel !== "SOFIA_AUTO_REPLY" && (!toE164 || !hasRetryBodyOrMedia)) {
        failed += 1;
        await pool.query(
          `
            UPDATE pendencias.crm_outbox
            SET status = 'FAILED', last_error = 'Payload inválido para retry', lock_owner = NULL, processing_started_at = NULL, updated_at = NOW()
            WHERE id = $1 AND lock_owner = $2
          `,
          [job.id, lockOwner]
        );
        continue;
      }

      const send =
        channel === "SOFIA_AUTO_REPLY"
          ? await (async () => {
              await runWebhookSofiaAutoReply(pool, {
                conversationId,
                leadId: String(payload?.leadId || ""),
                from: String(payload?.from || ""),
                text: String(payload?.text || ""),
              });
              return { ok: true, error: null as string | null, response: null as any };
            })()
          : channel === "WHATSAPP_EVOLUTION"
          ? await (async () => {
              const numberDigits = String(payload?.toE164 || toE164 || "");
              const evolutionConfig = {
                serverUrl: String(payload?.evolution?.serverUrl || ""),
                apiKey: String(payload?.evolution?.apiKey || ""),
                instanceName: String(payload?.evolution?.instanceName || ""),
              };
              const quotedContext =
                payload?.evolutionQuoted && typeof payload.evolutionQuoted === "object"
                  ? (payload.evolutionQuoted as any)
                  : null;
              const attachmentItems = payloadAttachments;
              let finalOk = true;
              let finalError: string | null = null;
              let finalResponse: any = null;
              for (let i = 0; i < attachmentItems.length; i++) {
                const item = attachmentItems[i] || {};
                const fileId = String(item?.fileId || "").trim();
                if (!fileId) continue;
                const file = await readFileBufferFromCatalog(pool, fileId);
                if (!file) {
                  finalOk = false;
                  finalError = `arquivo_retry_indisponivel_${fileId}`;
                  break;
                }
                const hinted = String(item?.mediaType || "").trim().toLowerCase();
                const mediatype =
                  hinted === "image" || hinted === "video" || hinted === "audio" || hinted === "document"
                    ? hinted
                    : evolutionMediatypeFromMime(file.mime);
                const capFirst = i === 0 ? body.slice(0, 1020) : "";
                const capTrim = capFirst.trim();
                const dataUri = `data:${file.mime};base64,${file.buffer.toString("base64")}`;
                let mediaResponse: { ok: boolean; error: string | null; response: any };
                if (mediatype === "audio") {
                  if (capTrim) {
                    const capResp = await evolutionSendText({
                      ...evolutionConfig,
                      numberDigits,
                      text: capTrim,
                      quotedContext: i === 0 ? quotedContext : null,
                    });
                    mediaResponse = capResp;
                    if (mediaResponse.ok) {
                      mediaResponse = await evolutionSendWhatsAppAudio({
                        ...evolutionConfig,
                        numberDigits,
                        audio: dataUri,
                        quotedContext: null,
                      });
                    }
                  } else {
                    mediaResponse = await evolutionSendWhatsAppAudio({
                      ...evolutionConfig,
                      numberDigits,
                      audio: dataUri,
                      quotedContext: i === 0 ? quotedContext : null,
                    });
                  }
                } else {
                  mediaResponse = await evolutionSendMedia({
                    ...evolutionConfig,
                    numberDigits,
                    mediatype,
                    mimetype: file.mime,
                    media: dataUri,
                    fileName: String(item?.fileName || file.name || "arquivo"),
                    caption: capFirst,
                    quotedContext: i === 0 ? quotedContext : null,
                  });
                }
                finalResponse = mediaResponse.response || finalResponse;
                if (!mediaResponse.ok) {
                  finalOk = false;
                  finalError = mediaResponse.error || "evolution_send_media_failed";
                  break;
                }
              }
              const tail = body.length > 1020 ? body.slice(1020).trim() : "";
              if (finalOk && tail) {
                const textResponse = await evolutionSendText({
                  ...evolutionConfig,
                  numberDigits,
                  text: tail,
                  quotedContext: attachmentItems.length ? null : quotedContext,
                });
                finalResponse = textResponse.response || finalResponse;
                if (!textResponse.ok) {
                  finalOk = false;
                  finalError = textResponse.error || "evolution_send_text_failed";
                }
              }
              if (finalOk && attachmentItems.length === 0 && body) {
                const textResponse = await evolutionSendText({
                  ...evolutionConfig,
                  numberDigits,
                  text: body,
                  quotedContext,
                });
                finalResponse = textResponse.response || finalResponse;
                if (!textResponse.ok) {
                  finalOk = false;
                  finalError = textResponse.error || "evolution_send_text_failed";
                }
              }
              return { ok: finalOk, error: finalError, response: finalResponse };
            })()
          : await sendWhatsAppText({ toE164: String(toE164 || ""), body });
      if (send.ok) {
        succeeded += 1;
        const waMessageId =
          channel === "WHATSAPP_EVOLUTION"
            ? extractEvolutionOutboundWaMessageId(send.response)
            : send.response?.messages?.[0]?.id || null;
        await pool.query(
          `
            UPDATE pendencias.crm_outbox
            SET status = 'SENT', last_error = NULL, lock_owner = NULL, processing_started_at = NULL, updated_at = NOW()
            WHERE id = $1 AND lock_owner = $2
          `,
          [job.id, lockOwner]
        );

        if (job.message_id) {
          await pool.query(
            `
              UPDATE pendencias.crm_messages
              SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
              WHERE id = $1
            `,
            [
              job.message_id,
              JSON.stringify({
                outbound_whatsapp: {
                  attempted: true,
                  delivered: false,
                  status: "sent",
                  message_id: waMessageId,
                  error: null,
                },
              }),
            ]
          );
        }
      } else {
        failed += 1;
        const nextAttempts = attempts + 1;
        const delaySec = Math.min(300, Math.pow(2, Math.min(nextAttempts, 6)) * 5);
        await pool.query(
          `
            UPDATE pendencias.crm_outbox
            SET
              attempts = $2,
              last_error = $3,
              status = CASE WHEN $2 >= 8 THEN 'FAILED' ELSE 'PENDING' END,
              next_attempt_at = NOW() + ($4::text || ' seconds')::interval,
              lock_owner = NULL,
              processing_started_at = NULL,
              updated_at = NOW()
            WHERE id = $1 AND lock_owner = $5
          `,
          [job.id, nextAttempts, send.error || "Falha retry", String(delaySec), lockOwner]
        );
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      succeeded,
      failed,
    });
  } catch (error) {
    console.error("WhatsApp retry outbox error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

