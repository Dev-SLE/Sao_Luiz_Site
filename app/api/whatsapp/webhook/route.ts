import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

function normalizeDigits(input: string) {
  return String(input || "").replace(/\D/g, "");
}

function lastN(input: string, n: number) {
  const d = normalizeDigits(input);
  if (d.length <= n) return d;
  return d.slice(-n);
}

function computeSignature(appSecret: string, rawBody: string) {
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody, "utf8");
  return hmac.digest("base64");
}

function parseWhatsAppText(message: any): string {
  if (!message) return "";
  if (message.type === "text" && message.text?.body) return String(message.text.body);
  if (message.type === "interactive" && message.interactive?.type) {
    // Botões/listas
    const it = message.interactive;
    if (it.type === "button_reply" && it.button_reply?.title) return String(it.button_reply.title);
    if (it.type === "list_reply" && it.list_reply?.title) return String(it.list_reply.title);
  }
  // Midia/unknown
  if (message.type === "image") return message.image?.caption ? String(message.image.caption) : "[Imagem recebida]";
  if (message.type === "audio") return "[Audio recebido]";
  if (message.type === "document") return message.document?.caption ? String(message.document.caption) : "[Documento recebido]";
  if (message.type === "video") return "[Video recebido]";
  return `[Mensagem ${String(message.type || "unknown")} recebida]`;
}

function extractCteFromText(text: string): string | null {
  // Padrão simples: qualquer sequência de 5+ dígitos
  const m = String(text || "").match(/\b\d{5,}\b/);
  return m ? m[0] : null;
}

async function ensureDefaultPipelineAndFirstStage(pool: any) {
  const pipelineRes = await pool.query(
    "SELECT id FROM pendencias.crm_pipelines WHERE is_default = true ORDER BY created_at ASC LIMIT 1"
  );
  let pipelineId = pipelineRes.rows?.[0]?.id as string | undefined;
  if (!pipelineId) {
    // Cria pipeline padrão como fallback (caso ainda não tenha sido carregado via /crm/board)
    await pool.query("UPDATE pendencias.crm_pipelines SET is_default = false");
    const pipelineInsert = await pool.query(
      `
        INSERT INTO pendencias.crm_pipelines (name, description, is_default, created_by, created_at, updated_at)
        VALUES ('Funil Padrão', 'Funil criado automaticamente', true, 'system', NOW(), NOW())
        RETURNING id
      `
    );
    pipelineId = pipelineInsert.rows?.[0]?.id as string | undefined;
    if (!pipelineId) return null;

    const stages = ["Novos", "Qualificando", "Negociando", "Fechado"];
    for (let i = 0; i < stages.length; i++) {
      await pool.query(
        `
          INSERT INTO pendencias.crm_stages (pipeline_id, name, position, created_at)
          VALUES ($1, $2, $3, NOW())
        `,
        [pipelineId, stages[i], i]
      );
    }
  }
  if (!pipelineId) return null;

  const stageRes = await pool.query(
    "SELECT id FROM pendencias.crm_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1",
    [pipelineId]
  );
  const stageId = stageRes.rows?.[0]?.id as string | undefined;
  if (!stageId) return null;

  return { pipelineId, stageId };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "WHATSAPP_VERIFY_TOKEN não configurado" }, { status: 500 });
  }

  if (mode === "subscribe" && token && challenge && token === expected) {
    return new NextResponse(String(challenge), { status: 200 });
  }

  return NextResponse.json({ error: "Verificação falhou" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const rawBody = await req.text();

    if (appSecret) {
      const signature = req.headers.get("x-hub-signature-256") || "";
      const parts = signature.split("=");
      const metaSignature = parts.length === 2 ? parts[1] : "";
      const expected = computeSignature(appSecret, rawBody);

      // Se assinatura não bater, rejeita (segurança básica).
      if (!metaSignature || metaSignature !== expected) {
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody || "{}");

    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        if (!messages.length) continue;

        for (const message of messages) {
          const from = String(message.from || "");
          const text = parseWhatsAppText(message);
          const cteDetected = extractCteFromText(text);

          const last10 = lastN(from, 10);
          const defaultIds = await ensureDefaultPipelineAndFirstStage(pool);
          if (!defaultIds) continue;

          // 1) Resolve lead por telefone (last 10 digits)
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
          } else {
            // 2) Cria lead automático para este número
            leadTitle = `WhatsApp ${last10 || from.slice(-4) || "Lead"}`;

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
                  pipeline_id,
                  stage_id,
                  title,
                  contact_phone,
                  cte_number,
                  cte_serie,
                  frete_value,
                  source,
                  priority,
                  current_location,
                  owner_username,
                  position,
                  created_at,
                  updated_at
                )
                VALUES ($1,$2,$3,$4,$5,NULL,NULL,'WHATSAPP','MEDIA',NULL,NULL,$6,NOW(),NOW())
                RETURNING id
              `,
              [defaultIds.pipelineId, defaultIds.stageId, leadTitle, from, cteDetected || null, position]
            );
            leadId = insertLead.rows?.[0]?.id as string;

            await pool.query(
              `
                INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
                VALUES ($1, NULL, 'EVENT', $2, '{}'::jsonb, NOW())
              `,
              [leadId, `Lead criado automaticamente via WhatsApp (${from})`]
            );
          }

          // 3) Garante conversation WHATSAPP
          const convRes = await pool.query(
            `
              SELECT id
              FROM pendencias.crm_conversations
              WHERE lead_id = $1 AND channel = 'WHATSAPP' AND is_active = true
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [leadId]
          );
          let conversationId: string;
          if (convRes.rows?.[0]?.id) {
            conversationId = convRes.rows[0].id as string;
          } else {
            const insertConv = await pool.query(
              `
                INSERT INTO pendencias.crm_conversations (lead_id, channel, is_active, created_at, last_message_at)
                VALUES ($1, 'WHATSAPP', true, NOW(), NULL)
                RETURNING id
              `,
              [leadId]
            );
            conversationId = insertConv.rows?.[0]?.id as string;
          }

          // 4) Salva mensagem no banco
          const isAttachment = message.type !== "text";
          await pool.query(
            `
              INSERT INTO pendencias.crm_messages (
                conversation_id,
                sender_type,
                body,
                has_attachments,
                metadata,
                created_at
              )
              VALUES ($1, 'CLIENT', $2, $3, $4::jsonb, NOW())
            `,
            [
              conversationId,
              text || "[Mensagem sem texto]",
              isAttachment,
              JSON.stringify({
                message_type: message.type,
                id: message.id,
                // Guarda o payload bruto pra fase 4 (arquivos)
                raw: message,
              }),
            ]
          );

          await pool.query(
            `
              UPDATE pendencias.crm_conversations
              SET last_message_at = NOW()
              WHERE id = $1
            `,
            [conversationId]
          );

          await pool.query(
            `
              INSERT INTO pendencias.crm_activities (lead_id, user_username, type, description, data, created_at)
              VALUES ($1, NULL, 'EVENT', 'Mensagem recebida via WhatsApp', $2::jsonb, NOW())
            `,
            [leadId, JSON.stringify({ from, message_type: message.type })]
          );

          // 5) Atualiza CTE no lead se detectado e estiver vazio
          if (cteDetected) {
            await pool.query(
              `
                UPDATE pendencias.crm_leads
                SET cte_number = COALESCE(cte_number, $1)
                WHERE id = $2
              `,
              [cteDetected, leadId]
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

