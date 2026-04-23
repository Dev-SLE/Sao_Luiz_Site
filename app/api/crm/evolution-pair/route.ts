import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { evolutionQrGetLast } from "../../../../lib/server/evolutionLastQr";
import { runEvolutionConnect, summarizeEvolutionInstance } from "../../../../lib/server/evolutionConnectHelpers";
import {
  evolutionExternalFetch,
  EVOLUTION_CONNECTION_USER_MESSAGE,
  isEvolutionNetworkError,
  normalizeEvolutionServerUrl,
} from "../../../../lib/server/evolutionUrl";
import { syncEvolutionInstanceWebhook } from "../../../../lib/server/evolutionWebhookSync";
import { syncEvolutionInstanceSettingsForCrm } from "../../../../lib/server/evolutionInstanceBootstrap";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";

export const runtime = "nodejs";

async function loadInbox(pool: any, inboxId: string) {
  const res = await pool.query(
    `
      SELECT
        id,
        name,
        evolution_instance_name,
        evolution_server_url,
        evolution_api_key
      FROM pendencias.crm_whatsapp_inboxes
      WHERE id = $1::uuid
        AND provider = 'EVOLUTION'
        AND is_active = true
      LIMIT 1
    `,
    [inboxId]
  );
  return res.rows?.[0] || null;
}

/** POST: gerar QR / reconectar; opcional sync webhook. */
export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_CRM_OPS"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const inboxId = body?.inboxId ? String(body.inboxId) : "";
    const phoneDigits = body?.phoneDigits != null ? String(body.phoneDigits).replace(/\D/g, "") : "";
    const syncWebhook = body?.syncWebhook === true;

    if (!inboxId) {
      return NextResponse.json({ error: "inboxId obrigatório" }, { status: 400 });
    }

    const row = await loadInbox(pool, inboxId);
    if (!row) {
      return NextResponse.json({ error: "Caixa não encontrada ou inativa" }, { status: 404 });
    }

    const serverUrlRaw = String(row.evolution_server_url || "").trim();
    const serverUrl = normalizeEvolutionServerUrl(serverUrlRaw);
    const apiKey = String(row.evolution_api_key || "").trim();
    const instance = String(row.evolution_instance_name || "").trim();

    if (!serverUrlRaw || !serverUrl || !apiKey || !instance) {
      return NextResponse.json(
        { error: "Caixa incompleta: URL do servidor, chave API e nome da instância são obrigatórios" },
        { status: 400 }
      );
    }

    const { httpStatus, evolution, fetchInstancesBody } = await runEvolutionConnect({
      baseUrl: serverUrl,
      apiKey,
      instance,
      numberDigits: phoneDigits.length >= 10 ? phoneDigits : null,
    });

    const summary = summarizeEvolutionInstance(fetchInstancesBody);

    const settingsSync = await syncEvolutionInstanceSettingsForCrm({
      serverUrl,
      apiKey,
      instance,
    });
    let webhookSync: Awaited<ReturnType<typeof syncEvolutionInstanceWebhook>> | null = null;
    if (syncWebhook) {
      webhookSync = await syncEvolutionInstanceWebhook({ serverUrl, apiKey, instance });
    }

    return NextResponse.json({
      ok: true,
      inboxName: row.name,
      instance,
      status: httpStatus,
      evolution,
      connectionHint: summary,
      settingsSync,
      syncWebhook: webhookSync,
    });
  } catch (e: any) {
    console.error("crm/evolution-pair POST:", e);
    const msg = e?.message || String(e);
    if (isEvolutionNetworkError(msg)) {
      return NextResponse.json(
        { error: "EVOLUTION_CONNECTION_FAILED", userMessage: EVOLUTION_CONNECTION_USER_MESSAGE },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET ?inboxId=&mode=status|qr */
export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["module.crm.view", "tab.crm.chat.view", "MANAGE_CRM_OPS"]);
    if (guard.denied) return guard.denied;
    await ensureCrmSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const inboxId = searchParams.get("inboxId");
    const mode = (searchParams.get("mode") || "status").toLowerCase();

    if (!inboxId) {
      return NextResponse.json({ error: "inboxId obrigatório" }, { status: 400 });
    }

    const row = await loadInbox(pool, inboxId);
    if (!row) {
      return NextResponse.json({ error: "Caixa não encontrada" }, { status: 404 });
    }

    const serverUrlRaw = String(row.evolution_server_url || "").trim();
    const serverUrl = normalizeEvolutionServerUrl(serverUrlRaw);
    const apiKey = String(row.evolution_api_key || "").trim();
    const instance = String(row.evolution_instance_name || "").trim();

    if (!serverUrlRaw || !serverUrl || !apiKey || !instance) {
      return NextResponse.json({ error: "Caixa incompleta" }, { status: 400 });
    }

    const base = serverUrl.replace(/\/+$/, "");

    if (mode === "qr") {
      const qr = evolutionQrGetLast(instance);
      if (!qr) {
        return NextResponse.json({ ok: true, hasQr: false, instance }, { status: 200 });
      }
      return NextResponse.json({ ok: true, hasQr: true, base64: qr.base64, ageMs: qr.ageMs, instance }, { status: 200 });
    }

    const fu = `${base}/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`;
    const fr = await evolutionExternalFetch(fu, {
      method: "GET",
      headers: { apikey: apiKey, accept: "application/json" },
      cache: "no-store",
    });
    const ft = await fr.text();
    let fetchInst: any;
    try {
      fetchInst = JSON.parse(ft);
    } catch {
      fetchInst = { raw: ft };
    }
    const summary = summarizeEvolutionInstance(fetchInst);
    return NextResponse.json({
      ok: true,
      instance,
      connection: summary,
      httpStatus: fr.status,
    });
  } catch (e: any) {
    console.error("crm/evolution-pair GET:", e);
    const msg = e?.message || String(e);
    if (isEvolutionNetworkError(msg)) {
      return NextResponse.json(
        { error: "EVOLUTION_CONNECTION_FAILED", userMessage: EVOLUTION_CONNECTION_USER_MESSAGE },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
