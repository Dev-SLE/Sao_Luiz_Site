const META_GRAPH = "https://graph.facebook.com/v23.0";

function metaOutboundLog(event: string, fields: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "meta_outbound", event, ...fields }));
  } catch {
    console.log("[meta_outbound]", event, fields);
  }
}

export type MetaOutboundMediaKind = "image" | "document" | "audio" | "video";

export async function metaUploadMediaBuffer(args: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ id: string } | { error: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { error: "WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado" };
  }
  const url = `${META_GRAPH}/${encodeURIComponent(phoneNumberId)}/media`;
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", args.mimeType || "application/octet-stream");
  form.set(
    "file",
    new Blob([new Uint8Array(args.buffer)], { type: args.mimeType || "application/octet-stream" }),
    args.fileName || "file.bin"
  );
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const json = (await resp.json().catch(() => ({}))) as any;
    if (!resp.ok) {
      const err = String(json?.error?.message || `HTTP ${resp.status}`);
      metaOutboundLog("upload_media_failed", {
        httpStatus: resp.status,
        mimeType: String(args.mimeType || "").slice(0, 80),
        fileName: String(args.fileName || "").slice(0, 120),
        error: err.slice(0, 400),
      });
      return { error: err };
    }
    const id = String(json?.id || "").trim();
    if (!id) return { error: "Meta não retornou id de mídia" };
    return { id };
  } catch (e: any) {
    const em = e?.message || String(e);
    metaOutboundLog("upload_media_failed", { httpStatus: 0, error: em.slice(0, 400) });
    return { error: em };
  }
}

export async function metaSendMessageWithUploadedMedia(args: {
  toE164: string;
  mediaId: string;
  kind: MetaOutboundMediaKind;
  caption?: string | null;
  documentFilename?: string | null;
  quotedMessageId?: string | null;
  /** Só `audio`: mensagem de voz (PTT) no WhatsApp. Predefinição true para gravações do CRM. */
  whatsappAudioVoice?: boolean;
}): Promise<{ ok: boolean; error: string | null; response: any }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: "WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado", response: null };
  }
  const url = `${META_GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: args.toE164,
    type: args.kind,
    ...(args.quotedMessageId ? { context: { message_id: String(args.quotedMessageId) } } : {}),
  };
  if (args.kind === "image") {
    payload.image = { id: args.mediaId, caption: args.caption || undefined };
  } else if (args.kind === "video") {
    payload.video = { id: args.mediaId, caption: args.caption || undefined };
  } else if (args.kind === "audio") {
    payload.audio = { id: args.mediaId };
  } else {
    payload.document = {
      id: args.mediaId,
      filename: args.documentFilename || "documento",
      ...(args.caption ? { caption: args.caption } : {}),
    };
  }
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = String((json as any)?.error?.message || `HTTP ${resp.status}`);
      metaOutboundLog("send_message_failed", {
        httpStatus: resp.status,
        kind: args.kind,
        error: err.slice(0, 400),
      });
      return { ok: false, error: err, response: json };
    }
    return { ok: true, error: null, response: json };
  } catch (e: any) {
    const em = e?.message || String(e);
    metaOutboundLog("send_message_failed", { httpStatus: 0, kind: args.kind, error: em.slice(0, 400) });
    return { ok: false, error: em, response: null };
  }
}

export function inferMetaOutboundKind(mime: string, hint?: string | null): MetaOutboundMediaKind {
  const h = String(hint || "").toLowerCase();
  if (h.includes("video")) return "video";
  if (h.includes("audio")) return "audio";
  if (h.includes("image")) return "image";
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("image/")) return "image";
  return "document";
}
