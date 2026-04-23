/**
 * Cliente HTTP mínimo para Evolution API v2 (self-hosted, sem custo de licença).
 * Doc: https://doc.evolution-api.com/v2/
 */

import {
  evolutionExternalFetch,
  evolutionIntegrationLog,
  normalizeEvolutionServerUrl,
} from "./evolutionUrl";

export function evolutionNumberDigits(remoteJid: string | null | undefined): string | null {
  if (!remoteJid) return null;
  const user = String(remoteJid).split("@")[0] || "";
  const base = user.split(":")[0] || user;
  const digits = base.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (!digits.startsWith("55") && digits.length >= 10) return `55${digits}`;
  return digits;
}

export function extractEvolutionMessageText(message: any): string {
  if (!message || typeof message !== "object") return "";
  const m = message;
  // Alguns payloads vêm embrulhados nesses nós
  if (m.message && typeof m.message === "object") return extractEvolutionMessageText(m.message);
  if (m.msg && typeof m.msg === "object") return extractEvolutionMessageText(m.msg);
  if (m.data && typeof m.data === "object") return extractEvolutionMessageText(m.data);
  if (m.conversation) return String(m.conversation);
  if (m.extendedTextMessage?.text) return String(m.extendedTextMessage.text);
  if (m.imageMessage?.caption) return String(m.imageMessage.caption);
  if (m.imageMessage) return "[Imagem recebida]";
  // Notas de voz costumam vir como pttMessage no Baileys
  if (m.pttMessage) return "[Áudio recebido]";
  if (m.audioMessage) return "[Áudio recebido]";
  if (m.videoMessage) return "[Vídeo recebido]";
  if (m.documentMessage?.caption) return String(m.documentMessage.caption);
  if (m.documentMessage) return "[Documento recebido]";
  if (m.documentWithCaptionMessage?.message?.documentMessage?.caption)
    return String(m.documentWithCaptionMessage.message.documentMessage.caption);
  if (m.documentWithCaptionMessage) return "[Documento recebido]";
  if (m.stickerMessage) return "[Figurinha recebida]";
  if (m.protocolMessage) return "[Mensagem do sistema recebida]";
  if (m.contactVcard) return "[Contato recebido]";
  if (m.locationMessage) return "[Localização recebida]";
  if (m.contactMessage) return "[Contato recebido]";
  if (m.contactsArrayMessage) return "[Contatos recebidos]";
  if (m.liveLocationMessage) return "[Localização ao vivo]";
  if (m.buttonsResponseMessage?.selectedDisplayText)
    return String(m.buttonsResponseMessage.selectedDisplayText);
  if (m.listResponseMessage?.title || m.listResponseMessage?.description) {
    const t = [m.listResponseMessage?.title, m.listResponseMessage?.description].filter(Boolean).join(" — ");
    return t || "[Resposta de lista recebida]";
  }
  if (m.reactionMessage) return "[Reação recebida]";
  if (m.pollCreationMessage) return "[Enquete recebida]";
  if (m.pollUpdateMessage) return "[Atualização de enquete recebida]";
  if (m.buttonsMessage) return "[Botões recebidos]";
  if (m.listMessage) return "[Lista recebida]";
  if (m.viewOnceMessage?.message) return extractEvolutionMessageText(m.viewOnceMessage.message);
  if (m.ephemeralMessage?.message) return extractEvolutionMessageText(m.ephemeralMessage.message);
  if (m.editedMessage?.message) return extractEvolutionMessageText(m.editedMessage.message);
  const messageType = String(m.messageType || m.type || m.mimetype || "").toLowerCase();
  if (messageType.includes("sticker")) return "[Figurinha recebida]";
  if (messageType.includes("image")) return "[Imagem recebida]";
  if (messageType.includes("video")) return "[Vídeo recebido]";
  if (messageType.includes("audio") || messageType.includes("ptt")) return "[Áudio recebido]";
  if (messageType.includes("contact")) return "[Contato recebido]";
  if (messageType.includes("document") || messageType.includes("file")) return "[Documento recebido]";
  if (messageType.includes("location")) return "[Localização recebida]";
  return "[Mensagem recebida]";
}

function parseEvolutionProfilePictureResponse(json: any): string | null {
  const urlKeys = [
    json?.profilePictureUrl,
    json?.profile_picture_url,
    json?.pictureUrl,
    json?.url,
    json?.avatarUrl,
    json?.imgUrl,
    json?.wuid,
    json?.data?.profilePictureUrl,
    json?.data?.profile_picture_url,
    json?.data?.pictureUrl,
    json?.data?.url,
    json?.data?.avatarUrl,
    json?.data?.wuid,
    json?.response?.profilePictureUrl,
    json?.response?.profile_picture_url,
    json?.response?.pictureUrl,
  ];
  for (const c of urlKeys) {
    const s = String(c || "").trim();
    if (s && /^https?:\/\//i.test(s)) return s;
  }
  const b64 =
    json?.base64 ||
    json?.profilePictureBase64 ||
    json?.pictureBase64 ||
    json?.data?.base64 ||
    json?.data?.profilePictureBase64;
  if (typeof b64 === "string" && b64.length > 40) {
    return b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
  }
  return null;
}

/** Código estável para UI/logs (sem corpo bruto da Evolution). */
export function evolutionClientErrorCode(args: { httpStatus: number; message?: string }): string {
  const st = Number(args.httpStatus) || 0;
  if (st === 401 || st === 403) return "EVOLUTION_AUTH";
  if (st === 404) return "EVOLUTION_NOT_FOUND";
  if (st >= 500) return "EVOLUTION_SERVER_ERROR";
  if (st >= 400) return "EVOLUTION_CLIENT_ERROR";
  const m = String(args.message || "").toLowerCase();
  if (m.includes("timeout") || m.includes("aborted")) return "EVOLUTION_TIMEOUT";
  if (m.includes("fetch failed") || m.includes("econnrefused") || m.includes("enotfound")) {
    return "EVOLUTION_NETWORK";
  }
  return "EVOLUTION_UNKNOWN";
}

/** POST em rotas de perfil da Evolution — foto quando o webhook não traz URL. */
export async function evolutionFetchProfilePictureUrl(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  /** Número E.164 ou JID (ex.: 5511999999999 ou 5511...@s.whatsapp.net) */
  number: string;
}): Promise<string | null> {
  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base || !args.apiKey || !args.instanceName) return null;
  const rawNum = String(args.number || "").trim();
  if (!rawNum) return null;
  const jidUser = rawNum.includes("@") ? rawNum.split("@")[0].split(":")[0] : rawNum.replace(/\D/g, "");
  const jid =
    rawNum.includes("@") ? rawNum : jidUser ? `${jidUser.replace(/\D/g, "")}@s.whatsapp.net` : "";
  if (!jid) return null;
  const digits = evolutionNumberDigits(rawNum.includes("@") ? rawNum : `${rawNum}@s.whatsapp.net`);
  const pathSuffixes = [
    `fetchProfilePictureUrl/${encodeURIComponent(args.instanceName)}`,
    `fetchProfile/${encodeURIComponent(args.instanceName)}`,
    `fetchProfilePicture/${encodeURIComponent(args.instanceName)}`,
  ];
  const bodyVariants: Record<string, string>[] = [];
  if (digits) {
    bodyVariants.push({ number: digits });
    bodyVariants.push({ number: `${digits}@s.whatsapp.net` });
  }
  bodyVariants.push({ jid });
  bodyVariants.push({ remoteJid: jid });
  if (digits) bodyVariants.push({ wid: digits });
  try {
    for (const suffix of pathSuffixes) {
      const url = `${base}/chat/${suffix}`;
      for (const bodyObj of bodyVariants) {
        const resp = await evolutionExternalFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: args.apiKey,
            accept: "application/json",
          },
          body: JSON.stringify(bodyObj),
        });
        if (!resp.ok) continue;
        const json = await resp.json().catch(() => ({}));
        const parsed = parseEvolutionProfilePictureResponse(json);
        if (parsed) return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function evolutionSendText(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  numberDigits: string;
  text: string;
  /**
   * Citação nativa no WhatsApp (Evolution v2 / Baileys): exige key.id, key.remoteJid e key.fromMe
   * + message.conversation — só `id` não renderiza resposta no aparelho.
   */
  quotedContext?: {
    waMessageId: string;
    remoteJid: string;
    fromMe: boolean;
    conversation?: string | null;
  } | null;
}) {
  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base) {
    return { ok: false, error: "evolution_server_url vazio", response: null as any };
  }
  const url = `${base}/message/sendText/${encodeURIComponent(args.instanceName)}`;
  const num = String(args.numberDigits || "").replace(/\D/g, "");
  if (!num) {
    return { ok: false, error: "número inválido", response: null as any };
  }
  const qc = args.quotedContext;
  let quotedPayload: Record<string, unknown> = {};
  if (qc?.waMessageId && qc.remoteJid) {
    const snippet = (String(qc.conversation || "").trim() || " ").slice(0, 900);
    quotedPayload = {
      quoted: {
        key: {
          id: String(qc.waMessageId),
          remoteJid: String(qc.remoteJid),
          fromMe: !!qc.fromMe,
        },
        message: {
          conversation: snippet,
        },
      },
      quotedMessageId: String(qc.waMessageId),
    };
  }
  try {
    const resp = await evolutionExternalFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: args.apiKey,
      },
      body: JSON.stringify({
        number: num,
        text: args.text,
        ...quotedPayload,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json as any)?.message || (json as any)?.error || `HTTP ${resp.status}`;
      const code = evolutionClientErrorCode({ httpStatus: resp.status, message: String(msg) });
      evolutionIntegrationLog("sendText_failed", {
        instanceName: args.instanceName,
        httpStatus: resp.status,
        code,
        error: String(msg).slice(0, 240),
      });
      return { ok: false, error: String(msg), response: json };
    }
    return { ok: true, error: null as string | null, response: json };
  } catch (e: any) {
    const em = e?.message || String(e);
    evolutionIntegrationLog("sendText_failed", {
      instanceName: args.instanceName,
      code: evolutionClientErrorCode({ httpStatus: 0, message: em }),
      error: em.slice(0, 240),
    });
    return { ok: false, error: em, response: null as any };
  }
}

/** Baixa mídia via Evolution (POST /chat/getBase64FromMediaMessage/{instance}). */
export async function evolutionGetBase64FromMediaMessage(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  /** Envelope { key, message } com um único nó de mídia em `message`. */
  message: { key: Record<string, unknown>; message: Record<string, unknown> };
}): Promise<{ buffer: Buffer | null; mimeType: string | null; error?: string }> {
  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base || !args.apiKey || !args.instanceName) {
    return { buffer: null, mimeType: null, error: "evolution_url_ou_credenciais_ausentes" };
  }
  const url = `${base}/chat/getBase64FromMediaMessage/${encodeURIComponent(args.instanceName)}`;
  let lastErr = "evolution_get_base64_failed";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await evolutionExternalFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: args.apiKey,
          accept: "application/json",
        },
        body: JSON.stringify({
          message: args.message,
          convertToMp4: false,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok) {
        const msg = json?.response?.message || json?.message || json?.error || `HTTP ${resp.status}`;
        const flat = Array.isArray(msg) ? msg.join(", ") : String(msg);
        lastErr = flat;
        evolutionIntegrationLog("getBase64_failed", {
          instanceName: args.instanceName,
          httpStatus: resp.status,
          error: flat.slice(0, 400),
        });
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * attempt));
        continue;
      }
      const raw =
        json?.base64 ||
        json?.data?.base64 ||
        json?.media?.base64 ||
        json?.response?.base64 ||
        json?.base64Data;
      let mime =
        json?.mimetype ||
        json?.mimeType ||
        json?.data?.mimetype ||
        json?.media?.mimetype ||
        null;
      if (typeof raw !== "string" || raw.length < 8) {
        lastErr = "resposta_sem_base64";
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * attempt));
        continue;
      }
      let b64 = raw.trim();
      if (b64.startsWith("data:")) {
        const semi = b64.indexOf(";");
        const comma = b64.indexOf(",");
        if (semi > 5 && comma > semi) {
          mime = mime || b64.slice(5, semi);
          b64 = b64.slice(comma + 1);
        }
      }
      const buffer = Buffer.from(b64, "base64");
      if (!buffer.length) {
        lastErr = "base64_invalido";
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * attempt));
        continue;
      }
      return { buffer, mimeType: mime ? String(mime) : null };
    } catch (e: any) {
      lastErr = e?.message || String(e);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }
  return { buffer: null, mimeType: null, error: lastErr };
}

export async function evolutionSendMedia(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  numberDigits: string;
  mediatype: "image" | "video" | "audio" | "document";
  /** URL pública, data URI base64 ou string base64 pura */
  media: string;
  mimetype?: string | null;
  fileName?: string | null;
  caption?: string | null;
  quotedContext?: {
    waMessageId: string;
    remoteJid: string;
    fromMe: boolean;
    conversation?: string | null;
  } | null;
}) {
  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base) return { ok: false, error: "evolution_server_url vazio", response: null as any };
  const num = String(args.numberDigits || "").replace(/\D/g, "");
  if (!num) return { ok: false, error: "número inválido", response: null as any };
  const url = `${base}/message/sendMedia/${encodeURIComponent(args.instanceName)}`;
  const qc = args.quotedContext;
  let quotedPayload: Record<string, unknown> = {};
  if (qc?.waMessageId && qc.remoteJid) {
    const snippet = (String(qc.conversation || "").trim() || " ").slice(0, 900);
    quotedPayload = {
      quoted: {
        key: {
          id: String(qc.waMessageId),
          remoteJid: String(qc.remoteJid),
          fromMe: !!qc.fromMe,
        },
        message: { conversation: snippet },
      },
    };
  }
  const body: Record<string, unknown> = {
    number: num,
    mediatype: args.mediatype,
    media: args.media,
    ...(args.mimetype ? { mimetype: args.mimetype } : {}),
    ...(args.fileName ? { fileName: args.fileName } : {}),
    ...(args.caption ? { caption: args.caption } : {}),
    ...quotedPayload,
  };
  try {
    const resp = await evolutionExternalFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: args.apiKey,
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json as any)?.message || (json as any)?.error || `HTTP ${resp.status}`;
      evolutionIntegrationLog("sendMedia_failed", {
        instanceName: args.instanceName,
        httpStatus: resp.status,
        error: String(msg).slice(0, 240),
      });
      return { ok: false, error: String(msg), response: json };
    }
    return { ok: true, error: null as string | null, response: json };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e), response: null as any };
  }
}

export async function evolutionDeleteMessageForEveryone(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  messageId: string;
  remoteJid: string;
  fromMe?: boolean;
  participant?: string | null;
}) {
  const base = normalizeEvolutionServerUrl(args.serverUrl).replace(/\/+$/, "");
  if (!base || !args.apiKey || !args.instanceName) {
    return { ok: false, error: "Credenciais/URL da Evolution inválidas", response: null as any };
  }
  const id = String(args.messageId || "").trim();
  const remoteJid = String(args.remoteJid || "").trim();
  if (!id || !remoteJid) {
    return { ok: false, error: "messageId e remoteJid são obrigatórios", response: null as any };
  }
  const url = `${base}/chat/deleteMessageForEveryone/${encodeURIComponent(args.instanceName)}`;
  const body = {
    id,
    remoteJid,
    fromMe: args.fromMe !== false,
    ...(args.participant ? { participant: String(args.participant).trim() } : {}),
  };
  try {
    // Algumas versões aceitam DELETE com body; outras só POST.
    for (const method of ["DELETE", "POST"] as const) {
      const resp = await evolutionExternalFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: args.apiKey,
          accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (resp.ok) return { ok: true, error: null as string | null, response: json };
    }
    evolutionIntegrationLog("deleteMessage_failed", {
      instanceName: args.instanceName,
      code: "EVOLUTION_DELETE_REJECTED",
    });
    return { ok: false, error: "Evolution não aceitou deleteMessageForEveryone", response: null as any };
  } catch (e: any) {
    const em = e?.message || String(e);
    evolutionIntegrationLog("deleteMessage_failed", {
      instanceName: args.instanceName,
      code: evolutionClientErrorCode({ httpStatus: 0, message: em }),
      error: em.slice(0, 240),
    });
    return { ok: false, error: em, response: null as any };
  }
}
