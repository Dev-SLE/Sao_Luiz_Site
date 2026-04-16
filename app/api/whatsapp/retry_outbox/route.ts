import { NextResponse } from "next/server";
import { requireApiPermissions, verifyCronSecret } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { evolutionSendText } from "../../../../lib/server/evolutionClient";
import { runWebhookSofiaAutoReply } from "../webhook/route";

export const runtime = "nodejs";

function normalizePhoneToE164(phoneRaw: string | null | undefined) {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
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

      if (channel !== "SOFIA_AUTO_REPLY" && (!toE164 || !body)) {
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
          ? await evolutionSendText({
              serverUrl: String(payload?.evolution?.serverUrl || ""),
              apiKey: String(payload?.evolution?.apiKey || ""),
              instanceName: String(payload?.evolution?.instanceName || ""),
              numberDigits: String(payload?.toE164 || toE164 || ""),
              text: body,
              quotedMessageId: payload?.replyToWhatsappMessageId ? String(payload.replyToWhatsappMessageId) : null,
            })
          : await sendWhatsAppText({ toE164: String(toE164 || ""), body });
      if (send.ok) {
        succeeded += 1;
        const waMessageId = send.response?.messages?.[0]?.id || null;
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
                  delivered: true,
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

