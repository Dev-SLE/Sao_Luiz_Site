import { graphClientId, graphClientSecret, graphTenantId } from "./sharepointConfig";

let cached: { token: string; exp: number } | null = null;

/**
 * Token de aplicação (client credentials) para Microsoft Graph.
 */
export async function getGraphAppAccessToken(): Promise<string> {
  const tenant = graphTenantId();
  const clientId = graphClientId();
  const clientSecret = graphClientSecret();
  if (!tenant || !clientId || !clientSecret) {
    throw new Error("GRAPH_TENANT_ID, GRAPH_CLIENT_ID e GRAPH_CLIENT_SECRET são obrigatórios");
  }
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 60) return cached.token;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || `Falha ao obter token Graph (${res.status})`);
  }
  const expIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cached = { token: json.access_token, exp: now + expIn };
  return json.access_token;
}
