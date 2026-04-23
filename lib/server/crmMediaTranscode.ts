import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { CrmMediaSettings } from "./crmMediaSettings";

export type TranscodeAudioResult =
  | { ok: true; buffer: Buffer; mimeType: string; fileName: string }
  | { ok: false; reason: string; buffer: Buffer; mimeType: string; fileName: string };

function ffmpegBin(): string | null {
  const fromEnv = String(process.env.FFMPEG_PATH || "").trim();
  if (fromEnv) return fromEnv;
  return "ffmpeg";
}

function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  const bin = ffmpegBin();
  if (!bin) return Promise.resolve({ code: 127, stderr: "ffmpeg não configurado" });
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr?.on("data", (c) => {
      err += String(c || "");
      if (err.length > 8000) err = err.slice(-4000);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr: err }));
    child.on("error", (e) => resolve({ code: 127, stderr: String((e as any)?.message || e) }));
  });
}

/**
 * Normaliza áudio para Ogg/Opus quando `force_transcode_audio` ou mime diferente do alvo.
 * Sem ffmpeg disponível, devolve o buffer original (caller decide FAILED vs STORED bruto).
 */
export async function maybeTranscodeInboundAudio(args: {
  buffer: Buffer;
  mimeType: string;
  baseFileName: string;
  settings: CrmMediaSettings;
}): Promise<TranscodeAudioResult> {
  const mime = String(args.mimeType || "").toLowerCase();
  const baseMime = mime.split(";")[0].trim();
  const targetNorm = String(args.settings.targetAudioMime || "audio/ogg").split(";")[0].trim().toLowerCase();
  const looksLikeTargetOggOpus =
    baseMime === targetNorm ||
    (baseMime === "audio/ogg" && (mime.includes("opus") || String(args.baseFileName || "").toLowerCase().endsWith(".opus")));

  const wantTranscode = args.settings.forceTranscodeAudio || !looksLikeTargetOggOpus;

  if (!wantTranscode) {
    return {
      ok: true,
      buffer: args.buffer,
      mimeType: baseMime || "audio/ogg",
      fileName: args.baseFileName,
    };
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "crm-audio-"));
  const inPath = path.join(tmpDir, "in.bin");
  const outPath = path.join(tmpDir, "out.ogg");
  try {
    await fs.promises.writeFile(inPath, args.buffer);
    const { code, stderr } = await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      outPath,
    ]);
    if (code !== 0) {
      if (args.settings.allowWavFallback && mime.includes("wav")) {
        return { ok: true, buffer: args.buffer, mimeType: mime, fileName: args.baseFileName };
      }
      return {
        ok: false,
        reason: `ffmpeg falhou (${code}): ${stderr.slice(0, 400)}`,
        buffer: args.buffer,
        mimeType: mime,
        fileName: args.baseFileName,
      };
    }
    const out = await fs.promises.readFile(outPath);
    const base = args.baseFileName.replace(/\.[^.]+$/, "") || "audio";
    return { ok: true, buffer: out, mimeType: "audio/ogg", fileName: `${base}.ogg` };
  } catch (e: any) {
    return {
      ok: false,
      reason: String(e?.message || e),
      buffer: args.buffer,
      mimeType: mime,
      fileName: args.baseFileName,
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
