import { randomUUID } from "crypto";

/** Nome físico estável no storage: AAAAMMDD_HHmmss_uuidcurto.ext */
export function buildStandardStoredFileName(originalName: string): { fileName: string; extension: string } {
  const base = String(originalName || "arquivo").trim() || "arquivo";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).replace(/[^\w]/g, "").slice(0, 10).toLowerCase() : "bin";
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const short = randomUUID().replace(/-/g, "").slice(0, 12);
  const fileName = `${datePart}_${short}.${ext || "bin"}`;
  return { fileName, extension: ext || "bin" };
}
