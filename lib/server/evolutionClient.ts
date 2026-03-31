/**
 * Cliente HTTP mínimo para Evolution API v2 (self-hosted, sem custo de licença).
 * Doc: https://doc.evolution-api.com/v2/
 */

import { evolutionExternalFetch, normalizeEvolutionServerUrl } from "./evolutionUrl";

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
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json as any)?.message || (json as any)?.error || `HTTP ${resp.status}`;
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
    return { ok: false, error: "Evolution não aceitou deleteMessageForEveryone", response: null as any };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e), response: null as any };
  }
}
