import type { Pool } from "pg";
import type { GraphDriveItem } from "@/lib/server/sharepointGraph";
import { ensureFolderPath, uploadBytesToDriveFolder } from "@/lib/server/sharepointGraph";
import { resolveDriveRefForLibrary } from "@/lib/server/sharepointConfig";
import { ensureStorageCatalogTables } from "@/lib/server/ensureSchema";
import { extensionAllowed, parseAllowedExtensions, renderPathTemplate } from "./pathTemplate";
import type { PathTemplateContext, FileRow, StorageRuleRow } from "./types";
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

export type PreparedSharePointCrmUpload = {
  rule: StorageRuleRow;
  driveRef: { siteId: string; driveId: string };
  folderItemId: string;
  storedFileName: string;
  extension: string;
  relativeFolder: string;
};

/** Resolve pasta + nome físico no drive (sem enviar bytes). */
export async function prepareSharePointCrmUpload(args: {
  pool: Pool;
  module: string;
  entity: string;
  originalName: string;
  pathContext: PathTemplateContext;
  /** Se definido, valida contra `max_file_size_mb` da regra. */
  expectedByteSize?: number;
}): Promise<PreparedSharePointCrmUpload> {
  await ensureStorageCatalogTables();
  const rule = await fetchActiveRule(args.pool, args.module, args.entity, "sharepoint");
  if (!rule) throw new Error(`Nenhuma regra de storage SharePoint para ${args.module}/${args.entity}`);

  const allowed = parseAllowedExtensions(rule.allowed_extensions);
  if (!extensionAllowed(args.originalName, allowed)) {
    throw new Error("Extensão de arquivo não permitida para este módulo");
  }
  if (args.expectedByteSize != null && rule.max_file_size_mb != null) {
    const maxB = rule.max_file_size_mb * 1024 * 1024;
    if (args.expectedByteSize > maxB) {
      throw new Error(`Arquivo excede o limite de ${rule.max_file_size_mb} MB`);
    }
  }

  const driveRef =
    rule.sharepoint_site_id && rule.sharepoint_drive_id
      ? { siteId: rule.sharepoint_site_id, driveId: rule.sharepoint_drive_id }
      : resolveDriveRefForLibrary(rule.library_name);
  if (!driveRef) throw new Error("SharePoint não configurado (site/drive)");

  const relativeFolder = renderPathTemplate(rule.path_template, args.pathContext);
  const folderItemId = await ensureFolderPath(driveRef.siteId, driveRef.driveId, relativeFolder);
  const { fileName, extension } = buildStandardStoredFileName(args.originalName);
  return { rule, driveRef, folderItemId, storedFileName: fileName, extension, relativeFolder };
}

/** Grava `pendencias.files` para um item já criado no SharePoint (upload direto ou sessão Graph). */
export async function insertSharePointFileFromDriveItem(args: {
  pool: Pool;
  module: string;
  entity: string;
  entityId: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  visibilityScope?: string | null;
  rule: StorageRuleRow;
  driveRef: { siteId: string; driveId: string };
  item: GraphDriveItem;
  relativeFolder: string;
  /** Nome físico esperado (ex.: do `buildStandardStoredFileName`); valida consistência com o item no drive. */
  expectedStoredFileName?: string;
  extension: string;
  /** Se true, marca metadata como upload por sessão Graph (ficheiro grande). */
  uploadSession?: boolean;
}): Promise<FileRow> {
  const {
    pool,
    module,
    entity,
    entityId,
    originalName,
    mimeType,
    fileSizeBytes,
    uploadedBy,
    visibilityScope,
    rule,
    driveRef,
    item,
    relativeFolder,
    expectedStoredFileName,
    extension,
    uploadSession,
  } = args;
  if (expectedStoredFileName && item.name && item.name !== expectedStoredFileName) {
    throw new Error("SharePoint: nome do ficheiro no drive não coincide com a sessão de upload");
  }
  const providerId = await getProviderUuid(pool, "sharepoint");
  if (!providerId) throw new Error("Provider sharepoint ausente no banco");

  const parentPath = item.parentReference?.path || "";
  const sharepointPath = `${parentPath}/${item.name}`.replace(/\/+/g, "/");
  const fileNameForRow = item.name || expectedStoredFileName || originalName;

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
      fileNameForRow,
      mimeType || "application/octet-stream",
      fileSizeBytes,
      extension,
      driveRef.siteId,
      driveRef.driveId,
      item.id,
      sharepointPath,
      uploadedBy,
      visibilityScope || rule.visibility_scope || "internal",
      JSON.stringify({
        library_name: rule.library_name,
        relative_folder: relativeFolder,
        ...(uploadSession ? { graph_upload_session: true } : {}),
      }),
    ]
  );

  const row = ins.rows?.[0] as FileRow;
  await recordFileAccess(pool, row.id, "upload", uploadedBy);
  return row;
}

/**
 * Upload para SharePoint conforme storage_rules + path_template; grava pendencias.files.
 */
export async function uploadFileToSharePoint(input: UploadSharePointInput): Promise<FileRow> {
  const { pool, module, entity, entityId, originalName, mimeType, buffer, uploadedBy, pathContext, visibilityScope } =
    input;
  const prep = await prepareSharePointCrmUpload({
    pool,
    module,
    entity,
    originalName,
    pathContext,
    expectedByteSize: buffer.length,
  });

  const item = await uploadBytesToDriveFolder({
    siteId: prep.driveRef.siteId,
    driveId: prep.driveRef.driveId,
    folderItemId: prep.folderItemId,
    fileName: prep.storedFileName,
    bytes: buffer,
    contentType: mimeType || "application/octet-stream",
  });

  return insertSharePointFileFromDriveItem({
    pool,
    module,
    entity,
    entityId,
    originalName,
    mimeType,
    fileSizeBytes: buffer.length,
    uploadedBy,
    visibilityScope,
    rule: prep.rule,
    driveRef: prep.driveRef,
    item,
    relativeFolder: prep.relativeFolder,
    expectedStoredFileName: prep.storedFileName,
    extension: prep.extension,
    uploadSession: false,
  });
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
