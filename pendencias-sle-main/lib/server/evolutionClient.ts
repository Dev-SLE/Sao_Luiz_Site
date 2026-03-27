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
  if (m.audioMessage) return "[Áudio recebido]";
  if (m.videoMessage) return "[Vídeo recebido]";
  if (m.documentMessage?.caption) return String(m.documentMessage.caption);
  if (m.documentMessage) return "[Documento recebido]";
  if (m.stickerMessage) return "[Figurinha recebida]";
  return "[Mensagem recebida]";
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
