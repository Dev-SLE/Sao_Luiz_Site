/**
 * Matriz de destino pós-login (Fase 1)
 *
 * - Login API grava cookie de sessão; o cliente redireciona conforme query `from` (path interno seguro)
 *   ou, na ausência, para `/inicio` (portal).
 * - Colaborador com apenas portal: permanece em `/inicio` e seções do portal.
 * - Anexos corporativos: SharePoint (Microsoft Graph); não há fluxo Google Drive no login.
 * - Usuário com módulos operacionais/CRM etc.: mesmo fluxo inicial para `/inicio`, com atalho
 *   "Área de trabalho" → `/app` quando tiver `workspace.app.view` (ou equivalente legado via aliases).
 * - Logout: limpa sessão e envia para `/login`.
 */

export const DEFAULT_POST_LOGIN_PATH = '/inicio';
