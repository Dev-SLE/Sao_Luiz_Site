/**
 * Configuração Microsoft Graph (app-only) + SharePoint.
 *
 * Provisionamento no tenant (manual ou script PnP):
 * 1. Entra ID → App registrations → novo app → Certificates & secrets (client secret ou cert).
 * 2. API permissions → Microsoft Graph → Application permissions:
 *    - Sites.ReadWrite.All (mais simples) ou combinação com Sites.Selected + POST /sites/{id}/permissions (recomendado em produção).
 *    - Files.ReadWrite.All se necessário conforme política da TI.
 * 3. Admin consent nas permissões.
 * 4. Criar site/biblioteca no SharePoint (ex.: biblioteca "Ocorrencias" no site operacional).
 * 5. Obter site id e drive id (biblioteca) via Graph Explorer: GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/NomeDoSite
 *    e GET .../sites/{id}/drives
 */

export type SharePointDriveRef = {
  siteId: string;
  driveId: string;
};

function trimEnv(key: string) {
  return String(process.env[key] || "").trim();
}

/** Tenant ID (Entra / Azure AD). */
export function graphTenantId() {
  return trimEnv("GRAPH_TENANT_ID");
}

export function graphClientId() {
  return trimEnv("GRAPH_CLIENT_ID");
}

export function graphClientSecret() {
  return trimEnv("GRAPH_CLIENT_SECRET");
}

/** Site SharePoint (ex.: contoso.sharepoint.com,abc123...,group) ou só o GUID do site. */
export function defaultSharePointSiteId() {
  return trimEnv("SHAREPOINT_SITE_ID");
}

/** Drive (biblioteca de documentos) padrão para anexos operacionais / ocorrências. */
export function defaultOperationalDriveId() {
  return trimEnv("SHAREPOINT_DRIVE_ID_OCORRENCIAS");
}

export function isSharePointGraphConfigured(): boolean {
  return !!(
    graphTenantId() &&
    graphClientId() &&
    graphClientSecret() &&
    defaultSharePointSiteId() &&
    defaultOperationalDriveId()
  );
}

/** Storage corporativo: apenas SharePoint (Google Drive desativado no produto). */
export function storageDefaultIsSharePoint(): boolean {
  return true;
}

export function resolveOperationalDriveRef(): SharePointDriveRef | null {
  if (!isSharePointGraphConfigured()) return null;
  return { siteId: defaultSharePointSiteId(), driveId: defaultOperationalDriveId() };
}

/** Bibliotecas adicionais no mesmo site (opcional). Se vazio, usa drive operacional. */
export function sharePointDriveIdPortal() {
  return trimEnv("SHAREPOINT_DRIVE_ID_PORTAL") || defaultOperationalDriveId();
}

export function resolveDriveRefForLibrary(libraryName: string | null | undefined): SharePointDriveRef | null {
  if (!isSharePointGraphConfigured()) return null;
  const site = defaultSharePointSiteId();
  const lib = String(libraryName || "").toLowerCase();
  if (lib.includes("portal") || lib.includes("treinamento") || lib.includes("documento") || lib.includes("comunicado")) {
    return { siteId: site, driveId: sharePointDriveIdPortal() };
  }
  return resolveOperationalDriveRef();
}
