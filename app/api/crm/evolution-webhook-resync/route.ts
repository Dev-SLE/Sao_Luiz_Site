import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { normalizeEvolutionServerUrl } from "../../../../lib/server/evolutionUrl";
import {
  fetchEvolutionWebhookFind,
  syncEvolutionInstanceWebhook,
  WEBHOOK_EVENT_SETS_FORCE_RESYNC,
} from "../../../../lib/server/evolutionWebhookSync";
import { syncEvolutionInstanceSettingsForCrm } from "../../../../lib/server/evolutionInstanceBootstrap";
import { maskEvolutionWebhookUrlForLog } from "../../../../lib/server/crmEvolutionDebug";

export const runtime = "nodejs";

/**
 * POST { inboxId } — reconfigura webhook na Evolution (enabled, url+token, webhookByEvents false,
 * webhookBase64 true, eventos alargados) + settings CRM. Usar durante diagnóstico de mídia.
 */
export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS"]);
    if (guard.denied) return guard.denied;

    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const inboxId = String(body?.inboxId || "").trim();
    if (!inboxId) {
      return NextResponse.json({ error: "inboxId obrigatório" }, { status: 400 });
    }

    const res = await pool.query(
      `
        SELECT id, name, evolution_instance_name, evolution_server_url, evolution_api_key
        FROM pendencias.crm_whatsapp_inboxes
        WHERE id = $1::uuid
          AND provider = 'EVOLUTION'
          AND is_active = true
        LIMIT 1
      `,
      [inboxId]
    );
    const row = res.rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Caixa Evolution não encontrada ou inativa" }, { status: 404 });
    }

    const serverUrl = normalizeEvolutionServerUrl(String(row.evolution_server_url || "").trim());
    const apiKey = String(row.evolution_api_key || "").trim();
    const instance = String(row.evolution_instance_name || "").trim();
    if (!serverUrl || !apiKey || !instance) {
      return NextResponse.json(
        { error: "Caixa incompleta: evolution_server_url, evolution_api_key e evolution_instance_name são obrigatórios" },
        { status: 400 }
      );
    }

    const settingsSync = await syncEvolutionInstanceSettingsForCrm({
      serverUrl,
      apiKey,
      instance,
    });

    let webhookSync = await syncEvolutionInstanceWebhook({
      serverUrl,
      apiKey,
      instance,
      eventSets: WEBHOOK_EVENT_SETS_FORCE_RESYNC,
    });
    const triedForceEventSet = true;
    if (!webhookSync.ok) {
      webhookSync = await syncEvolutionInstanceWebhook({
        serverUrl,
        apiKey,
        instance,
      });
    }

    const webhookFind = await fetchEvolutionWebhookFind({ serverUrl, apiKey, instance });
    const findJson = webhookFind.json as Record<string, unknown> | null;
    const findUrlMasked =
      typeof findJson?.url === "string" ? maskEvolutionWebhookUrlForLog(String(findJson.url)) : findJson?.url ?? null;
    const findJsonSafe =
      findJson && typeof findJson === "object"
        ? { ...findJson, url: typeof findJson.url === "string" ? findUrlMasked : findJson.url }
        : findJson;

    const { webhookUrl: _omitToken, ...webhookSyncSafe } = webhookSync;

    return NextResponse.json({
      ok: webhookSync.ok,
      inboxId,
      inboxName: row.name,
      instance,
      settingsSync,
      webhookSync: webhookSyncSafe,
      webhookUrlMasked: webhookSync.webhookUrlMasked,
      webhookTokenSource: webhookSync.webhookTokenSource,
      eventsApplied: webhookSync.eventsApplied,
      triedForceEventSet,
      webhookFind: {
        ok: webhookFind.ok,
        httpStatus: webhookFind.httpStatus,
        urlMasked: findUrlMasked,
        enabled: findJson?.enabled ?? (findJson?.webhook as Record<string, unknown> | undefined)?.enabled ?? null,
        webhookByEvents:
          findJson?.webhookByEvents ?? findJson?.webhook_by_events ?? (findJson?.webhook as any)?.byEvents ?? null,
        webhookBase64:
          findJson?.webhookBase64 ?? findJson?.webhook_base64 ?? (findJson?.webhook as any)?.base64 ?? null,
        events: findJson?.events ?? null,
        jsonMasked: findJsonSafe,
      },
    });
  } catch (e: any) {
    console.error("[evolution-webhook-resync]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
