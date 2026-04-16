import type { Pool } from "pg";
import { ensureFolderPath, uploadBytesToDriveFolder } from "@/lib/server/sharepointGraph";
import { resolveDriveRefForLibrary } from "@/lib/server/sharepointConfig";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { extensionAllowed, parseAllowedExtensions, renderPathTemplate } from "./pathTemplate";
import type { PathTemplateContext, FileRow } from "./types";
import { fetchActiveRule } from "./routingRuleService";
import { buildStandardStoredFileName } from "./standardFileName";

async function getProviderUuid(pool: Pool, name: string): Promise<string | null> {
  const r = await pool.query(`SELECT id FROM pendencias.storage_providers WHERE name = $1 LIMIT 1`, [name]);
  return r.rows?.[0]?.id || null;
}

export async function recordFileAccess(pool: Pool, fileId: string, action: string, username: string | null) {
  await pool.query(`INSERT INTO pendencias.file_access_audit (file_id, action, username) VALUES ($1::uuid, $2, $3)`, [
    fileId,
    action,
    username,
  ]);
}

export type UploadSharePointInput = {
  pool: Pool;
  module: string;
  entity: string;
  entityId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedBy: string;
  pathContext: PathTemplateContext;
  visibilityScope?: string;
};

/**
 * Upload para SharePoint conforme storage_rules + path_template; grava pendencias.files.
 */
export async function uploadFileToSharePoint(input: UploadSharePointInput): Promise<FileRow> {
  const { pool, module, entity, entityId, originalName, mimeType, buffer, uploadedBy, pathContext, visibilityScope } = input;
  await ensureStorageCatalogTables();

  const rule = await fetchActiveRule(pool, module, entity, "sharepoint");
  if (!rule) throw new Error(`Nenhuma regra de storage SharePoint para ${module}/${entity}`);

  const allowed = parseAllowedExtensions(rule.allowed_extensions);
  if (!extensionAllowed(originalName, allowed)) {
    throw new Error("Extensão de arquivo não permitida para este módulo");
  }
  if (rule.max_file_size_mb != null && buffer.length > rule.max_file_size_mb * 1024 * 1024) {
    throw new Error(`Arquivo excede o limite de ${rule.max_file_size_mb} MB`);
  }

  const driveRef =
    rule.sharepoint_site_id && rule.sharepoint_drive_id
      ? { siteId: rule.sharepoint_site_id, driveId: rule.sharepoint_drive_id }
      : resolveDriveRefForLibrary(rule.library_name);
  if (!driveRef) throw new Error("SharePoint não configurado (site/drive)");

  const relativeFolder = renderPathTemplate(rule.path_template, pathContext);
  const folderId = await ensureFolderPath(driveRef.siteId, driveRef.driveId, relativeFolder);

  const { fileName, extension } = buildStandardStoredFileName(originalName);
  const item = await uploadBytesToDriveFolder({
    siteId: driveRef.siteId,
    driveId: driveRef.driveId,
    folderItemId: folderId,
    fileName,
    bytes: buffer,
    contentType: mimeType || "application/octet-stream",
  });

  const providerId = await getProviderUuid(pool, "sharepoint");
  if (!providerId) throw new Error("Provider sharepoint ausente no banco");

  const parentPath = item.parentReference?.path || "";
  const sharepointPath = `${parentPath}/${item.name}`.replace(/\/+/g, "/");

  const ins = await pool.query(
    `
    INSERT INTO pendencias.files (
      provider_id, module, entity, entity_id, title, original_name, file_name, mime_type, file_size, extension,
      sharepoint_site_id, sharepoint_drive_id, sharepoint_item_id, sharepoint_path,
      uploaded_by, visibility_scope, metadata_json
    )
    VALUES (
      $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, $17::jsonb
    )
    RETURNING *
  `,
    [
      providerId,
      module,
      entity,
      entityId,
      originalName,
      originalName,
      fileName,
      mimeType || "application/octet-stream",
      buffer.length,
      extension,
      driveRef.siteId,
      driveRef.driveId,
      item.id,
      sharepointPath,
      uploadedBy,
      visibilityScope || rule.visibility_scope || "internal",
      JSON.stringify({ library_name: rule.library_name, relative_folder: relativeFolder }),
    ]
  );

  const row = ins.rows?.[0] as FileRow;
  await recordFileAccess(pool, row.id, "upload", uploadedBy);
  return row;
}

export async function getFileById(pool: Pool, id: string): Promise<FileRow | null> {
  await ensureStorageCatalogTables();
  const r = await pool.query(`SELECT * FROM pendencias.files WHERE id = $1::uuid AND is_active = true LIMIT 1`, [id]);
  return (r.rows?.[0] as FileRow) || null;
}

export async function listFilesForEntity(pool: Pool, module: string, entity: string, entityId: string): Promise<FileRow[]> {
  await ensureStorageCatalogTables();
  const r = await pool.query(
    `SELECT * FROM pendencias.files WHERE module = $1 AND entity = $2 AND entity_id = $3 AND is_active = true ORDER BY uploaded_at DESC`,
    [module, entity, entityId]
  );
  return (r.rows || []) as FileRow[];
}
