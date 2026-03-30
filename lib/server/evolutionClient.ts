/**
 * Cliente HTTP mínimo para Evolution API v2 (self-hosted, sem custo de licença).
 * Doc: https://doc.evolution-api.com/v2/
 */

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
  if (m.stickerMessage) return "[Figurinha recebida]";
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
  if (m.viewOnceMessage?.message) return extractEvolutionMessageText(m.viewOnceMessage.message);
  if (m.ephemeralMessage?.message) return extractEvolutionMessageText(m.ephemeralMessage.message);
  if (m.editedMessage?.message) return extractEvolutionMessageText(m.editedMessage.message);
  return "[Mensagem recebida]";
}

/** POST /chat/fetchProfilePictureUrl/{instance} — foto quando o webhook não traz URL. */
export async function evolutionFetchProfilePictureUrl(args: {
  serverUrl: string;
  apiKey: string;
  instanceName: string;
  /** Número E.164 ou JID (ex.: 5511999999999 ou 5511...@s.whatsapp.net) */
  number: string;
}): Promise<string | null> {
  const base = String(args.serverUrl || "").replace(/\/+$/, "");
  if (!base || !args.apiKey || !args.instanceName) return null;
  const num = String(args.number || "").trim();
  if (!num) return null;
  const endpointCandidates = [
    `${base}/chat/fetchProfilePictureUrl/${encodeURIComponent(args.instanceName)}`,
    `${base}/chat/fetchProfile/${encodeURIComponent(args.instanceName)}`,
  ];
  const parseCandidate = (json: any): string | null => {
    const candidates = [
      json?.profilePictureUrl,
      json?.profile_picture_url,
      json?.pictureUrl,
      json?.avatarUrl,
      json?.data?.profilePictureUrl,
      json?.data?.profile_picture_url,
      json?.data?.pictureUrl,
      json?.data?.avatarUrl,
      json?.response?.profilePictureUrl,
      json?.response?.profile_picture_url,
    ];
    for (const c of candidates) {
      const s = String(c || "").trim();
      if (s && /^https?:\/\//i.test(s)) return s;
    }
    return null;
  };
  try {
    for (const url of endpointCandidates) {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: args.apiKey,
        },
        body: JSON.stringify({ number: num }),
      });
      if (!resp.ok) continue;
      const json = await resp.json().catch(() => ({}));
      const parsed = parseCandidate(json);
      if (parsed) return parsed;
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
  const base = String(args.serverUrl || "").replace(/\/+$/, "");
  if (!base) {
    return { ok: false, error: "evolution_server_url vazio", response: null as any };
  }
  const url = `${base}/message/sendText/${encodeURIComponent(args.instanceName)}`;
  const num = String(args.numberDigits || "").replace(/\D/g, "");
  if (!num) {
    return { ok: false, error: "número inválido", response: null as any };
  }
  try {
    const resp = await fetch(url, {
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
