import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";
import { getEvolutionServerDefaults, slugifyInstancePart } from "../../../../lib/server/evolutionDefaults";
import { getSitePublicBaseUrl } from "../../../../lib/sitePublicUrl";

export const runtime = "nodejs";

async function generateUniqueEvolutionInstanceName(pool: any, displayName: string): Promise<string> {
  const part = slugifyInstancePart(displayName);
  for (let i = 0; i < 12; i++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const candidate = `sle-${part}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 56);
    const dup = await pool.query(
      `
        SELECT 1 FROM pendencias.crm_whatsapp_inboxes
        WHERE lower(btrim(evolution_instance_name)) = lower(btrim($1))
        LIMIT 1
      `,
      [candidate]
    );
    if (!dup.rows?.length) return candidate;
  }
  return `sle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 56);
}

async function evolutionTryCreateInstance(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
}): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const base = String(args.serverUrl || "").replace(/\/+$/, "");
  const url = `${base}/instance/create`;
  const body = {
    instanceName: String(args.instanceName || "").trim(),
    integration: "WHATSAPP-BAILEYS",
    qrcode: false,
  };
  if (!body.instanceName) return { ok: false, error: "Nome da instância vazio" };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { apikey: args.apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    const msg = String((j as any)?.message || (j as any)?.error || "").toLowerCase();
    if (r.ok) return { ok: true };
    if (r.status === 409 || msg.includes("already") || msg.includes("exist") || msg.includes("duplicate")) {
      return { ok: true, duplicate: true };
    }
    return { ok: false, error: String((j as any)?.message || (j as any)?.error || `HTTP ${r.status}`) };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const s = String(key);
  if (s.length <= 4) return "****";
  return `…${s.slice(-4)}`;
}

async function syncEvolutionWebhookForInstance(args: {
  serverUrl: string;
  apiKey: string;
  instance: string;
}) {
  const token = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
  const publicBase = getSitePublicBaseUrl();
  if (!publicBase) {
    return {
      ok: false,
      error: "Defina NEXT_PUBLIC_APP_URL ou EVOLUTION_WEBHOOK_PUBLIC_BASE para sincronizar webhook.",
    };
  }
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const webhookUrl = `${publicBase.replace(/\/+$/, "")}/api/whatsapp/evolution/webhook${qs}`;
  const payload = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events: [
      "QRCODE_UPDATED",
      "CONNECTION_UPDATE",
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "MESSAGES_EDITED",
    ],
  };
  try {
    const base = args.serverUrl.replace(/\/+$/, "");
    const r = await fetch(`${base}/webhook/set/${encodeURIComponent(args.instance)}`, {
      method: "POST",
      headers: { apikey: args.apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let evolution: unknown;
    try {
      evolution = JSON.parse(text);
    } catch {
      evolution = { raw: text };
    }
    return { ok: r.ok, httpStatus: r.status, webhookUrl, evolution };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    let query = `
      SELECT
        id,
        name,
        provider,
        phone_number_id,
        evolution_instance_name,
        evolution_server_url,
        evolution_api_key,
        team_id,
        is_active,
        created_at
      FROM pendencias.crm_whatsapp_inboxes
      WHERE 1=1
    `;
    const params: any[] = [];
    if (provider) {
      params.push(provider.toUpperCase());
      query += ` AND provider = $${params.length}`;
    }
    query += ` ORDER BY provider ASC, name ASC`;

    const res = await pool.query(query, params);
    const evolutionDefaultsConfigured = Boolean(getEvolutionServerDefaults());
    const inboxes = (res.rows || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      provider: String(r.provider || "META"),
      phoneNumberId: r.phone_number_id ? String(r.phone_number_id) : null,
      evolutionInstanceName: r.evolution_instance_name ? String(r.evolution_instance_name) : null,
      evolutionServerUrl: r.evolution_server_url ? String(r.evolution_server_url) : null,
      hasEvolutionApiKey: Boolean(r.evolution_api_key && String(r.evolution_api_key).length > 0),
      evolutionApiKeyLast4: maskKey(r.evolution_api_key),
      teamId: r.team_id ? String(r.team_id) : null,
      isActive: !!r.is_active,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ inboxes, evolutionDefaultsConfigured });
  } catch (e) {
    console.error("whatsapp-inboxes GET:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "UPSERT_EVOLUTION").toUpperCase();

    if (action === "DELETE") {
      const id = body?.id ? String(body.id) : null;
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      await pool.query(
        `UPDATE pendencias.crm_whatsapp_inboxes SET is_active = false, updated_at = NOW() WHERE id = $1::uuid`,
        [id]
      );
      return NextResponse.json({ success: true });
    }

    if (action !== "UPSERT_EVOLUTION") {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    const id = body?.id ? String(body.id) : null;
    const name = String(body?.name || "").trim();
    const simpleConnect = body?.simpleConnect === true;
    let evolutionInstanceName = String(body?.evolutionInstanceName || "").trim();
    let evolutionServerUrl = String(body?.evolutionServerUrl || "")
      .trim()
      .replace(/\/+$/, "");
    let evolutionApiKey = body?.evolutionApiKey != null ? String(body.evolutionApiKey).trim() : "";
    const teamId =
      body?.teamId != null && String(body.teamId).trim() ? String(body.teamId).trim() : null;
    const defaults = getEvolutionServerDefaults();

    /** Modo simples: cria instância na Evolution por padrão, salvo se vier explicitamente false. */
    let provisionEvolutionInstance = body?.provisionEvolutionInstance === true;
    if (simpleConnect && !id && body?.provisionEvolutionInstance !== false) {
      provisionEvolutionInstance = true;
    }

    if (!name) {
      return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
    }

    if (id) {
      const cur = await pool.query(
        `
          SELECT evolution_server_url, evolution_api_key
          FROM pendencias.crm_whatsapp_inboxes
          WHERE id = $1::uuid AND provider = 'EVOLUTION'
          LIMIT 1
        `,
        [id]
      );
      const row = cur.rows?.[0];
      if (!evolutionServerUrl && row?.evolution_server_url) {
        evolutionServerUrl = String(row.evolution_server_url).trim().replace(/\/+$/, "");
      }
      if (!evolutionApiKey && row?.evolution_api_key) {
        evolutionApiKey = String(row.evolution_api_key).trim();
      }
      if (!evolutionServerUrl && defaults?.serverUrl) evolutionServerUrl = defaults.serverUrl;
      if (!evolutionApiKey && defaults?.apiKey) evolutionApiKey = defaults.apiKey;

      if (!evolutionInstanceName) {
        return NextResponse.json({ error: "evolutionInstanceName obrigatório" }, { status: 400 });
      }
      if (!evolutionServerUrl || !evolutionApiKey) {
        return NextResponse.json(
          {
            error:
              "URL e chave da Evolution ausentes. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor ou preencha em modo avançado.",
          },
          { status: 400 }
        );
      }

      await pool.query(
        `
          UPDATE pendencias.crm_whatsapp_inboxes
          SET
            name = $2,
            evolution_instance_name = $3,
            evolution_server_url = $4,
            evolution_api_key = $5,
            team_id = $6::uuid,
            is_active = true,
            updated_at = NOW()
          WHERE id = $1::uuid AND provider = 'EVOLUTION'
        `,
        [id, name, evolutionInstanceName, evolutionServerUrl, evolutionApiKey, teamId]
      );
      const webhookSync = await syncEvolutionWebhookForInstance({
        serverUrl: evolutionServerUrl,
        apiKey: evolutionApiKey,
        instance: evolutionInstanceName,
      });
      return NextResponse.json({ success: true, id, evolutionInstanceName, webhookSync });
    }

    if (!evolutionInstanceName) {
      if (simpleConnect) {
        evolutionInstanceName = await generateUniqueEvolutionInstanceName(pool, name);
      } else {
        return NextResponse.json({ error: "evolutionInstanceName obrigatório" }, { status: 400 });
      }
    }

    if (!evolutionServerUrl && defaults?.serverUrl) evolutionServerUrl = defaults.serverUrl;
    if (!evolutionApiKey && defaults?.apiKey) evolutionApiKey = defaults.apiKey;

    if (!evolutionServerUrl || !evolutionApiKey) {
      return NextResponse.json(
        {
          error:
            "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor (Vercel) para o modo rápido, ou informe URL e chave no formulário avançado.",
        },
        { status: 400 }
      );
    }

    if (provisionEvolutionInstance) {
      const prov = await evolutionTryCreateInstance({
        serverUrl: evolutionServerUrl,
        apiKey: evolutionApiKey,
        instanceName: evolutionInstanceName,
      });
      if (!prov.ok) {
        return NextResponse.json(
          { error: `Não foi possível criar a instância na Evolution: ${prov.error || "erro desconhecido"}` },
          { status: 400 }
        );
      }
    }

    const ins = await pool.query(
      `
      INSERT INTO pendencias.crm_whatsapp_inboxes (
        name,
        provider,
        phone_number_id,
        evolution_instance_name,
        evolution_server_url,
        evolution_api_key,
        team_id,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, 'EVOLUTION', NULL, $2, $3, $4, $5::uuid, true, NOW(), NOW())
      RETURNING id
    `,
      [name, evolutionInstanceName, evolutionServerUrl, evolutionApiKey, teamId]
    );
    const webhookSync = await syncEvolutionWebhookForInstance({
      serverUrl: evolutionServerUrl,
      apiKey: evolutionApiKey,
      instance: evolutionInstanceName,
    });

    return NextResponse.json({
      success: true,
      id: ins.rows?.[0]?.id,
      evolutionInstanceName,
      simpleConnect,
      webhookSync,
    });
  } catch (e: any) {
    console.error("whatsapp-inboxes POST:", e);
    const msg = e?.code === "23505" ? "Nome de instância Evolution já cadastrado" : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
