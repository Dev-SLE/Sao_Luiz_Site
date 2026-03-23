import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const CANDIDATE_PATHS = [
  // Imagem anexada no Cursor (prioridade)
  "C:/Users/dev/.cursor/projects/c-Users-dev-Downloads-Pendencias/assets/c__Users_dev_Downloads_Pendencias_ChatGPT_Image_20_de_mar._de_2026__18_30_15.png",
  // Fallback dentro do projeto
  path.join(process.cwd(), "public", "logo_transparente.png"),
];

export async function GET() {
  try {
    for (const candidate of CANDIDATE_PATHS) {
      try {
        const data = await fs.readFile(candidate);
        return new NextResponse(data, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        // tenta próximo caminho
      }
    }
    return NextResponse.json({ error: "Imagem da Sofia não encontrada" }, { status: 404 });
  } catch (error) {
    console.error("Sofia mascot asset GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

