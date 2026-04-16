/** Enriquece linha de `content_items` com URLs de streaming e MIME das mídias vinculadas. */
export function mapContentRow(row: Record<string, unknown>) {
  const coverId = row.cover_file_id as string | null | undefined;
  const mainId = row.main_file_id as string | null | undefined;
  const cover_mime = (row.cover_mime as string | null | undefined) || null;
  const main_mime = (row.main_mime as string | null | undefined) || null;
  const rest = { ...row };
  delete (rest as { cover_mime?: unknown }).cover_mime;
  delete (rest as { main_mime?: unknown }).main_mime;
  return {
    ...rest,
    cover_view_url: coverId ? `/api/files/${coverId}/view` : null,
    main_view_url: mainId ? `/api/files/${mainId}/view` : null,
    main_download_url: mainId ? `/api/files/${mainId}/download` : null,
    cover_mime,
    main_mime,
  };
}
