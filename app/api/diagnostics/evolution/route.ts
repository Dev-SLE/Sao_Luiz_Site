import { NextResponse } from "next/server";
import { requireApiPermissions } from "@/lib/server/apiAuth";
import { getPool } from "@/lib/server/db";
import { normalizeEvolutionServerUrl } from "@/lib/server/evolutionUrl";
import { getEvolutionServerDefaults } from "@/lib/server/evolutionDefaults";
import { getSitePublicBaseUrl } from "@/lib/sitePublicUrl";

export const runtime = "nodejs";

function mask(s: string | null | undefined, keep = 4): string {
  const v = String(s ?? "").trim();
  if (!v) return "";
  if (v.length <= keep) return "***";
  return `${v.slice(0, 2)}…${v.slice(-keep)}`;
}

/**
 * GET /api/diagnostics/evolution — checagem de env + inboxes Neon + reachability (GET raiz).
 * Requer MANAGE_SETTINGS. Não expõe segredos completos.
 */
export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;

    const defaults = getEvolutionServerDefaults();
    const expected = defaults?.serverUrl
      ? normalizeEvolutionServerUrl(defaults.serverUrl).replace(/\/+$/, "").toLowerCase()
      : "";

    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      name: string;
      evolution_instance_name: string | null;
      evolution_server_url: string | null;
      has_key: boolean;
    }>(
      `SELECT id, name, evolution_instance_name, evolution_server_url,
              (evolution_api_key IS NOT NULL AND btrim(evolution_api_key) <> '') AS has_key
       FROM pendencias.crm_whatsapp_inboxes
       WHERE provider = 'EVOLUTION'
       ORDER BY name`
    );

    const inboxReport = rows.map((r) => {
      const norm = r.evolution_server_url
        ? normalizeEvolutionServerUrl(String(r.evolution_server_url)).replace(/\/+$/, "").toLowerCase()
        : "";
      let host: string | null = null;
      if (norm) {
        try {
          host = new URL(norm).host;
        } catch {
          host = null;
        }
      }
      return {
        id: r.id,
        name: r.name,
        instance: r.evolution_instance_name,
        hasApiKey: r.has_key,
        serverUrlHost: host,
        matchesEnvDefaults: expected ? (norm ? norm === expected : false) : null,
      };
    });

    let reachability: { ok: boolean; status?: number; error?: string; ms?: number } = { ok: false };
    if (defaults?.serverUrl && defaults.apiKey) {
      const base = normalizeEvolutionServerUrl(defaults.serverUrl).replace(/\/+$/, "");
      const t0 = Date.now();
      try {
        const r = await fetch(`${base}/`, {
          method: "GET",
          headers: { apikey: defaults.apiKey, accept: "application/json" },
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });
        reachability = { ok: r.ok || r.status === 404 || r.status === 401, status: r.status, ms: Date.now() - t0 };
      } catch (e: any) {
        reachability = { ok: false, error: e?.message || String(e), ms: Date.now() - t0 };
      }
    } else {
      reachability = { ok: false, error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY ausentes" };
    }

    const webhookToken = String(process.env.EVOLUTION_WEBHOOK_TOKEN ?? "").trim();
    const publicBase = getSitePublicBaseUrl();
    let publicBaseHost: string | null = null;
    if (publicBase) {
      try {
        publicBaseHost = new URL(publicBase).host;
      } catch {
        publicBaseHost = null;
      }
    }

    return NextResponse.json({
      ok: true,
      env: {
        evolutionApiUrlConfigured: Boolean(process.env.EVOLUTION_API_URL?.trim()),
        evolutionApiKeyLast4: mask(process.env.EVOLUTION_API_KEY, 4),
        evolutionWebhookTokenConfigured: Boolean(webhookToken),
        evolutionConnectProxyEnabled: process.env.EVOLUTION_CONNECT_PROXY_ENABLED === "true",
        nextPublicAppUrlConfigured: Boolean(publicBase),
        publicBaseHost,
      },
      defaultsFromEnv: defaults
        ? {
            serverUrlNormalized: normalizeEvolutionServerUrl(defaults.serverUrl).replace(/\/+$/, ""),
            apiKeyLast4: mask(defaults.apiKey, 4),
          }
        : null,
      evolutionInboxes: inboxReport,
      reachability,
    });
  } catch (e) {
    console.error("[diagnostics.evolution]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
