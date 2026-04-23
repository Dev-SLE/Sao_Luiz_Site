import type { PathTemplateContext } from "./types";

export function safePathSegment(s: string) {
  return String(s || "")
    .replace(/[^\w\-./]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
}

/** Substitui {chaves} no path_template pelo contexto. */
export function renderPathTemplate(template: string, ctx: PathTemplateContext): string {
  const map: Record<string, string> = {
    year: ctx.year,
    month: ctx.month,
    entity_id: safePathSegment(ctx.entity_id || ""),
    dossier_id: safePathSegment(ctx.dossier_id || ctx.entity_id || ""),
    cte: safePathSegment(ctx.cte || ""),
    serie: safePathSegment(ctx.serie || ""),
    subtype: safePathSegment(ctx.subtype || "geral"),
    category_slug: safePathSegment(ctx.category_slug || "geral"),
    content_slug: safePathSegment(ctx.content_slug || "item"),
    conversation_id: safePathSegment(ctx.conversation_id || ""),
    media_type: safePathSegment((ctx.media_type || "file").toLowerCase()),
    provider_slug: safePathSegment((ctx.provider_slug || "crm").toLowerCase()),
  };
  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{${k}}`).join(v);
  }
  out = out.replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
  return out;
}

export function parseAllowedExtensions(raw: string | null | undefined): string[] | null {
  if (!raw || !String(raw).trim()) return null;
  return String(raw)
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
}

export function extensionAllowed(fileName: string, allowed: string[] | null): boolean {
  if (!allowed || allowed.length === 0) return true;
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  return allowed.includes(ext);
}
