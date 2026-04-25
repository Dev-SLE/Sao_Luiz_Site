import React, { useState } from 'react';
import clsx from 'clsx';
import { FileText, Image as ImageIcon, Video, Volume2, AlertCircle, ExternalLink, Smile } from 'lucide-react';

/** Metadados canónicos gravados em `crm_message_media.metadata_json.normalized` (GET /api/crm/messages). */
export type CrmChatAttachmentNormalized = {
  tipo: string;
  storage_provider: "sharepoint";
  storage_path: string | null;
  file_catalog_id: string | null;
  nome_arquivo: string;
  nome_original: string | null;
  mime_type: string;
  extensao: string;
  tamanho_bytes: number;
};

export type CrmChatAttachment = {
  id?: string;
  mediaType?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  fileId?: string | null;
  viewUrl?: string | null;
  downloadUrl?: string | null;
  processingStatus?: string | null;
  processingError?: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  inlineVideoAllowed?: boolean | null;
  normalized?: CrmChatAttachmentNormalized | null;
};

type Props = {
  attachments: CrmChatAttachment[];
  isMe: boolean;
  /** Texto da mensagem (evita duplicar aviso de falha quando o corpo já é placeholder de mídia). */
  messageText?: string | null;
};

/**
 * Esconde só falhas "fantasma" (tipo WA errado no getBase64): outro anexo já OK na mesma mensagem,
 * ou figurinha com linha image falhando enquanto o corpo já diz [Figurinha recebida].
 * Não esconder para áudio/imagem/etc. isolados — senão some o único feedback e parece que "não chegou".
 */
function filenameLooksCorruptClient(name: string | null | undefined): boolean {
  const s = String(name || "").trim();
  if (!s) return true;
  return /object\s*object/i.test(s);
}

/** Rótulo para UI: API já sanitiza na maioria dos casos; fallback para anexos antigos. */
function attachmentDisplayFilename(a: CrmChatAttachment): string | null {
  const n = a.normalized?.nome_arquivo?.trim();
  if (n) return n;
  const f = a.filename?.trim();
  if (f && !filenameLooksCorruptClient(f)) return f;
  const mt = String(a.mediaType || a.mimeType || "").toLowerCase();
  const mime = String(a.mimeType || "");
  if (mt.includes("image") || mime.startsWith("image/")) return "Imagem";
  if (mt.includes("video") || mime.startsWith("video/")) return "Vídeo";
  if (mt.includes("audio") || mime.startsWith("audio/")) return "Áudio";
  if (mt.includes("document")) return "Documento";
  if (mt.includes("sticker")) return "Figurinha";
  return "Ficheiro";
}

function shouldHidePhantomTypeMismatchFailure(
  messageText: string | undefined | null,
  att: CrmChatAttachment,
  all: CrmChatAttachment[]
) {
  if (String(att.processingStatus || "") !== "FAILED") return false;
  const err = String(att.processingError || "").toLowerCase();
  if (!err.includes("not of the media type")) return false;

  const hasOtherStored = all.some(
    (x) =>
      x !== att &&
      String(x.processingStatus || "") === "STORED" &&
      (Boolean(x.fileId) || Boolean(x.viewUrl))
  );
  if (hasOtherStored) return true;

  const t = String(messageText || "").trim();
  const mt = String(att.mediaType || "").toLowerCase();
  if (/^\[figurinha recebida\]$/i.test(t) && mt.includes("image")) return true;

  return false;
}

export const CrmMessageAttachments: React.FC<Props> = ({ attachments, isMe, messageText }) => {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const list = Array.isArray(attachments) ? attachments : [];
  const visible = list.filter((a) => !shouldHidePhantomTypeMismatchFailure(messageText, a, list));
  if (!visible.length) return null;

  const subtle = isMe ? 'text-white/75' : 'text-slate-500';

  return (
    <div className={clsx('mt-2 space-y-2 text-[11px]', subtle)}>
      {visible.map((a, idx) => {
        const key = a.id || `att-${idx}`;
        const displayName = attachmentDisplayFilename(a);
        const mt = String(a.mediaType || a.mimeType || '').toLowerCase();
        const href = a.viewUrl || a.downloadUrl || null;
        const dl = a.downloadUrl || a.viewUrl || null;
        const pending = a.processingStatus && !['STORED', 'FAILED'].includes(String(a.processingStatus));
        const failed = String(a.processingStatus || '') === 'FAILED';

        if (failed) {
          return (
            <div
              key={key}
              className={clsx(
                'flex items-start gap-2 rounded-lg border px-2 py-1.5',
                isMe ? 'border-white/30 bg-white/10' : 'border-rose-200 bg-rose-50 text-rose-800'
              )}
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                Mídia recebida; falha ao carregar o ficheiro
                {a.processingError ? ` (${String(a.processingError).slice(0, 120)})` : ''}
              </span>
            </div>
          );
        }

        if (pending) {
          return (
            <div key={key} className="italic text-[10px]">
              Mídia em processamento ({String(a.processingStatus || 'PENDING').toLowerCase()})…
            </div>
          );
        }

        if (mt === 'sticker' || mt.includes('sticker')) {
          if (!href) {
            return (
              <div key={key} className="flex items-center gap-1">
                <Smile size={14} /> {displayName || 'Figurinha'}
              </div>
            );
          }
          return (
            <div key={key} className="space-y-1">
              <button
                type="button"
                className="block w-full max-w-[160px] rounded-lg overflow-hidden border border-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sl-navy/40 bg-white/70"
                onClick={() => setLightbox(href)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={href} alt={displayName || 'Figurinha'} className="w-full h-auto object-contain max-h-40" loading="lazy" />
              </button>
              <div className="text-[10px]">Figurinha</div>
            </div>
          );
        }

        if (mt === 'image' || mt.includes('image')) {
          if (!href) {
            return (
              <div key={key} className="flex items-center gap-1">
                <ImageIcon size={14} /> {displayName || 'Imagem'}
              </div>
            );
          }
          return (
            <div key={key} className="space-y-1">
              <button
                type="button"
                className="block w-full max-w-[220px] rounded-lg overflow-hidden border border-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sl-navy/40"
                onClick={() => setLightbox(href)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={href} alt={displayName || ''} className="w-full h-auto object-cover max-h-48 bg-black/5" loading="lazy" />
              </button>
              {displayName ? <div className="truncate text-[10px]">{displayName}</div> : null}
            </div>
          );
        }

        if (mt === 'video' || mt.includes('video')) {
          if (a.inlineVideoAllowed === false && href) {
            return (
              <a
                key={key}
                href={dl || href}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 underline-offset-2 hover:underline',
                  isMe ? 'border-white/25 bg-white/10 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'
                )}
              >
                <ExternalLink size={14} />
                Vídeo (abrir / baixar)
              </a>
            );
          }
          if (href) {
            return (
              <video
                key={key}
                src={href}
                controls
                className="max-w-full max-h-52 rounded-lg border border-black/10 bg-black/5"
              />
            );
          }
          return (
            <div key={key} className="flex items-center gap-1">
              <Video size={14} /> {displayName || 'Vídeo'}
            </div>
          );
        }

        if (mt === 'audio' || mt.includes('audio')) {
          if (href) {
            return (
              <div key={key} className="flex items-center gap-2">
                <Volume2 size={14} className="shrink-0" />
                <audio src={href} controls className="h-8 max-w-[220px]" />
              </div>
            );
          }
          return (
            <div key={key} className="flex items-center gap-1">
              <Volume2 size={14} /> {displayName || 'Áudio'}
            </div>
          );
        }

        return (
          <div key={key} className="flex items-center gap-2">
            <FileText size={14} />
            {dl ? (
              <a
                href={dl}
                target="_blank"
                rel="noreferrer"
                className={clsx('underline underline-offset-2', isMe ? 'text-white' : 'text-sl-navy')}
              >
                {displayName || 'Documento'}
              </a>
            ) : (
              <span>{displayName || 'Documento'}</span>
            )}
          </div>
        );
      })}

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[95vw] rounded-lg shadow-2xl" />
        </button>
      ) : null}
    </div>
  );
};
