import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { getPool } from "../../../lib/server/db";
import { getDriveFolderId, getGoogleOAuthClient } from "../../../lib/server/googleDrive";
import { ensureUserTokensTable } from "../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const username = String(form.get("username") || "").trim();

    if (!file || typeof file === "string") return NextResponse.json({ success: false, error: "Arquivo não enviado." }, { status: 400 });
    if (!username) return NextResponse.json({ success: false, error: "Username necessário." }, { status: 400 });

    const pool = getPool();
    await ensureUserTokensTable();
    const tokenResult = await pool.query("SELECT * FROM pendencias.user_tokens WHERE username = $1", [username]);
    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Usuário não autenticado no Google. Faça login em /api/auth/google?username=${username}` },
        { status: 401 }
      );
    }

    const userToken = tokenResult.rows[0];
    const oAuth2Client = getGoogleOAuthClient();
    oAuth2Client.setCredentials({
      access_token: userToken.access_token,
      refresh_token: userToken.refresh_token,
      expiry_date: userToken.expiry_date,
    });

    const drive = google.drive({ version: "v3", auth: oAuth2Client });

    const f = file as File;
    const arrayBuffer = await f.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const folderId = getDriveFolderId();

    const response = await drive.files.create({
      requestBody: {
        name: f.name,
        parents: [folderId],
      },
      media: {
        mimeType: f.type || "application/octet-stream",
        body: Readable.from(buffer),
      },
    });

    const fileId = response.data.id;
    if (!fileId) throw new Error("Drive não retornou fileId");

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return NextResponse.json({ success: true, url: previewUrl, downloadUrl, id: fileId });
  } catch (error) {
    console.error("Erro no upload:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

