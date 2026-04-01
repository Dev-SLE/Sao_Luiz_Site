import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Paperclip, Loader2, CheckCircle2, Check, History, FileText, Music, Film, ExternalLink, Image as ImageIcon, Trash2, File as FileIcon } from 'lucide-react';
import { CteData, NoteData } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import { Package, Scale, Coins, Tag } from 'lucide-react';
import { authClient } from '../lib/auth';
import { AppMessageModal, type AppMessageVariant } from './AppOverlays';

// --- Helpers ---

const getFileIdFromUrl = (url: string): string => {
  if (!url) return '';
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  match = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return '';
};

const detectMimeType = (url: string): string => {
  if (!url) return '';
  const u = url.toLowerCase();
  if (getFileIdFromUrl(url)) return 'application/vnd.google-apps.file';
  if (u.startsWith('data:image')) return 'image/jpeg';
  if (u.startsWith('data:application/pdf')) return 'application/pdf';
  if (u.includes('audio') || u.endsWith('.mp3') || u.endsWith('.wav') || u.endsWith('.ogg') || u.endsWith('.m4a') || u.endsWith('.aac')) return 'audio/mpeg';
  if (u.includes('video') || u.endsWith('.mp4') || u.endsWith('.mkv') || u.endsWith('.mov') || u.endsWith('.avi') || u.endsWith('.webm')) return 'video/mp4';
  if (u.includes('pdf') || u.endsWith('.pdf')) return 'application/pdf';
  if (u.includes('spreadsheet') || u.includes('excel') || u.endsWith('.xlsx') || u.endsWith('.xls') || u.endsWith('.csv')) return 'application/vnd.ms-excel';
  if (u.includes('document') || u.includes('word') || u.endsWith('.docx') || u.endsWith('.doc')) return 'application/msword';
  if (u.includes('image') || u.endsWith('.jpg') || u.endsWith('.png') || u.endsWith('.jpeg') || u.endsWith('.gif') || u.endsWith('.webp') || u.endsWith('.bmp')) return 'image/jpeg';
  return 'application/octet-stream';
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                const scaleSize = MAX_WIDTH / img.width;
                const newWidth = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
                const newHeight = (img.width > MAX_WIDTH) ? img.height * scaleSize : img.height;
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject('Canvas context failed'); return; }
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const parseDateString = (dateStr: string) => {
    if (!dateStr) return 0;
    try {
        const [d, t] = dateStr.split(' ');
        const [day, month, year] = d.split('/').map(Number);
        let hour = 0, min = 0, sec = 0;
        if (t) [hour, min, sec] = t.split(':').map(Number);
        return new Date(year, month - 1, day, hour, min, sec || 0).getTime();
    } catch { return 0; }
};

interface MediaAttachmentProps {
    url: string;
    onImageClick: (url: string) => void;
}

const MediaAttachment: React.FC<MediaAttachmentProps> = ({ url, onImageClick }) => {
  const fileId = getFileIdFromUrl(url);
  const mimeType = detectMimeType(url);
  const isGoogleDrive = !!fileId;

  if (isGoogleDrive) {
      return (
          <div className="media-container drive-container bg-white p-2 rounded-lg border border-slate-200 mt-2">
               <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wide">
                      <FileIcon size={14} className="text-primary-400" /> Arquivo no Drive
                  </div>
                  <a href={url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300" title="Abrir em nova aba">
                      <ExternalLink size={14} />
                  </a>
               </div>
               <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                 A visualização incorporada do Google Drive pode ser bloqueada por políticas de segurança do navegador.
                 <a href={url} target="_blank" rel="noreferrer" className="ml-1 font-bold text-[#2c348c] underline">
                   Abrir arquivo no Drive
                 </a>
               </div>
          </div>
      );
  }

  if (mimeType.startsWith('image/')) {
     return (
        <div className="mt-2 space-y-2">
            <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm max-w-sm">
                <img 
                    src={url} 
                    alt="Anexo" 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover max-h-[300px] cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => onImageClick(url)} 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            </div>
        </div>
     );
  }

  let icon = <FileText size={18} />;
  let label = "Visualizar Arquivo";
  let colorClass = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
  
  if (mimeType.includes('pdf')) {
      label = "Visualizar PDF";
      colorClass = "text-red-200 bg-red-900/60 border-red-500/70 hover:bg-red-900/80";
  }

  return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2 group text-decoration-none">
        <div className={`rounded-lg p-3 flex items-center justify-between transition-colors border ${colorClass}`}>
            <div className="flex items-center gap-2 font-bold text-sm">
                {icon}
                <span>{label}</span>
            </div>
            <ExternalLink size={14} className="opacity-50 group-hover:opacity-100" />
        </div>
      </a>
  );
};

interface Props {
  cte: CteData;
  onClose: () => void;
}

interface PendingFile {
    name: string;
    type: string;
    base64: string;
    file?: File;
}

const NoteModal: React.FC<Props> = ({ cte, onClose }) => {
  const { notes, addNote, resolveIssue, baseData, isCteEmBusca, isCteOcorrencia, getLatestNote, processControlData, hasPermission } = useData();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isSearch, setIsSearch] = useState(false);
  const [isOcorrencia, setIsOcorrencia] = useState(false);
  const [occurrenceType, setOccurrenceType] = useState('AVARIA');
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolveChecked, setResolveChecked] = useState(false);
  const [showConfirmResolve, setShowConfirmResolve] = useState(false);
  const [expandedAttachments, setExpandedAttachments] = useState<Record<string, boolean>>({});
  const [noteNotice, setNoteNotice] = useState<{
    title: string;
    message: string;
    variant: AppMessageVariant;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  if (!cte) return null;

  const normalizeSerie = (s: string) => String(s).replace(/^0+/, '');
  const liveCte = baseData.find(c => c.CTE === cte.CTE && normalizeSerie(c.SERIE) === normalizeSerie(cte.SERIE)) || cte;
  const [remoteNotes, setRemoteNotes] = useState<NoteData[] | null>(null);
  const [remoteProcess, setRemoteProcess] = useState<any[] | null>(null);

  const normalizeNoteRow = (row: any): NoteData => ({
    ID: row?.id?.toString?.() || row?.ID?.toString?.() || '',
    CTE: row?.cte || row?.CTE || '',
    SERIE: row?.serie || row?.SERIE || '',
    CODIGO: row?.codigo || row?.CODIGO || '',
    DATA: row?.data || row?.DATA || '',
    USUARIO: row?.usuario || row?.USUARIO || '',
    TEXTO: row?.texto || row?.TEXTO || '',
    LINK_IMAGEM: row?.link_imagem || row?.LINK_IMAGEM || '',
    STATUS_BUSCA: row?.status_busca || row?.STATUS_BUSCA || '',
    pending: false,
  });

  useEffect(() => {
    let cancelled = false;
    setRemoteNotes(null);
    setRemoteProcess(null);
    (async () => {
      try {
        const n = await authClient.getNotesForCte(cte.CTE);
        if (!cancelled) {
          const normalized: NoteData[] = (n || []).map((row: any) => ({
            ID: row.id?.toString() || '',
            CTE: row.cte || '',
            SERIE: row.serie || '',
            CODIGO: row.codigo || '',
            DATA: row.data || '',
            USUARIO: row.usuario || '',
            TEXTO: row.texto || '',
            LINK_IMAGEM: row.link_imagem || '',
            STATUS_BUSCA: row.status_busca || '',
            pending: false,
          }));
          setRemoteNotes(normalized);
        }
      } catch {
        if (!cancelled) setRemoteNotes([]);
      }
      try {
        const p = await authClient.getProcessForCteSerie(cte.CTE, cte.SERIE || '0');
        if (!cancelled) setRemoteProcess(p || []);
      } catch {
        if (!cancelled) setRemoteProcess([]);
      }
    })();
    return () => { cancelled = true; };
  }, [cte.CTE, cte.SERIE]);

  const currentNotes = (remoteNotes ?? notes.filter(n => n.CTE === cte.CTE));
  const isCurrentlyEmBusca = isCteEmBusca(liveCte.CTE, liveCte.SERIE, liveCte.STATUS);
  const isCurrentlyOcorrencia = isCteOcorrencia(liveCte.CTE, liveCte.SERIE);
  const latestNote = getLatestNote(liveCte.CTE);
  const isResolvido = (liveCte.STATUS === 'RESOLVIDO' || liveCte.STATUS === 'LOCALIZADA') || (latestNote && (latestNote.STATUS_BUSCA === 'RESOLVIDO' || latestNote.STATUS_BUSCA === 'LOCALIZADA'));
  const processHistory = (remoteProcess ?? processControlData.filter(p => p.CTE === liveCte.CTE && normalizeSerie(p.SERIE || '') === normalizeSerie(liveCte.SERIE || '')));
  const sortedProcessHistory = [...processHistory].sort((a, b) => parseDateString(b.DATA) - parseDateString(a.DATA));

  const hasTxEntrega = parseFloat((liveCte.TX_ENTREGA || '0').toString().replace('R$', '').replace(/\./g, '').replace(',', '.')) > 0;

  const handleUploadClick = () => { if (!isSending) fileInputRef.current?.click(); };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles: PendingFile[] = [];
      const filesArr: File[] = Array.from(event.target.files);
      for (const file of filesArr) {
          try {
              let base64 = "";
              if (file.type.startsWith('image/')) {
                  base64 = await compressImage(file);
              } else {
                  base64 = await fileToBase64(file);
              }
              newFiles.push({ name: file.name, type: file.type, base64: base64, file });
          } catch (e) {
            setNoteNotice({
              title: 'Arquivo',
              message: `Não foi possível processar o arquivo "${file.name}". Tente outro formato ou tamanho.`,
              variant: 'error',
            });
          }
      }
      setPendingFiles(prev => [...prev, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => { if (!isSending) setPendingFiles(prev => prev.filter((_, i) => i !== index)); };

  const confirmResolveAction = async () => {
      setShowConfirmResolve(false);
      try { 
          const resolveText = isCurrentlyOcorrencia ? "RESOLVIDO: OCORRÊNCIA ENCERRADA." : undefined;
          await resolveIssue(cte.CTE, cte.SERIE, resolveText); 
      } catch (err) { setResolveChecked(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && pendingFiles.length === 0) return;
    if (isOcorrencia && !text.trim()) {
      setNoteNotice({
        title: 'Ocorrência',
        message: 'Informe os detalhes da ocorrência no texto antes de enviar.',
        variant: 'warning',
      });
      return;
    }
    if (!hasPermission('EDIT_NOTES')) {
      setNoteNotice({
        title: 'Permissão',
        message: 'Seu perfil não possui permissão para registrar anotações.',
        variant: 'warning',
      });
      return;
    }

    setIsSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: NoteData = {
      ID: tempId,
      CTE: cte.CTE,
      SERIE: cte.SERIE || '',
      CODIGO: cte.CODIGO,
      DATA: new Date().toISOString(),
      USUARIO: user?.username || 'Sistema',
      TEXTO: text || (pendingFiles.length > 0 ? "Anexo enviado" : ""),
      LINK_IMAGEM: '',
      STATUS_BUSCA: isSearch ? 'EM BUSCA' : (isOcorrencia ? 'OCORRENCIA' : ''),
      pending: true,
    };
    setRemoteNotes(prev => {
      const base = Array.isArray(prev) ? prev : [];
      return [optimistic, ...base];
    });
    try {
      const finalText = isOcorrencia ? `[${occurrenceType}] ${text}` : text;
      const created = await addNote({
        CTE: cte.CTE, SERIE: cte.SERIE || '', CODIGO: cte.CODIGO, DATA: '', 
        USUARIO: user?.username || 'Sistema', TEXTO: finalText || (pendingFiles.length > 0 ? "Anexo enviado" : ""), 
        LINK_IMAGEM: '', 
        STATUS_BUSCA: isSearch ? 'EM BUSCA' : (isOcorrencia ? 'OCORRENCIA' : ''), 
        attachments: pendingFiles
      });
      if (created) {
        const normalized = normalizeNoteRow(created);
        setRemoteNotes(prev => {
          const base = Array.isArray(prev) ? prev : [];
          return [normalized, ...base.filter(n => n.ID !== tempId)];
        });
      } else {
        setRemoteNotes(prev => {
          const base = Array.isArray(prev) ? prev : [];
          return base.filter(n => n.ID !== tempId);
        });
      }
      setText(''); setIsSearch(false); setIsOcorrencia(false); setOccurrenceType('AVARIA'); setPendingFiles([]);
    } catch (error) {
      setRemoteNotes(prev => {
        const base = Array.isArray(prev) ? prev : [];
        return base.filter(n => n.ID !== tempId);
      });
      setNoteNotice({
        title: 'Envio',
        message: 'Não foi possível enviar a anotação. Tente novamente.',
        variant: 'error',
      });
    } finally { setIsSending(false); }
  };

  const getLinks = (linkStr: string): string[] => {
      if (!linkStr) return [];
      return linkStr.split(/[\s,]+/).filter(l => l.length > 5);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      
      {previewUrl && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewUrl(null)}>
          <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors" onClick={() => setPreviewUrl(null)}>
            <X size={32} />
          </button>
          <img src={previewUrl} referrerPolicy="no-referrer" alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {showConfirmResolve && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
             <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl">
                 <div className="flex flex-col items-center text-center">
                     <div className="w-12 h-12 bg-emerald-900/70 rounded-full flex items-center justify-center text-emerald-300 mb-4">
                       <Check size={28} />
                     </div>
                     <h3 className="text-lg font-bold mb-2">
                        {isCurrentlyOcorrencia ? 'Confirmar encerramento da ocorrência?' : 'Gravar como Localizada?'}
                     </h3>
                     <p className="text-sm text-slate-600 mb-6">
                       O status mudará para <strong className="text-emerald-300">RESOLVIDO</strong>.
                     </p>
                     <div className="flex gap-3 w-full">
                         <button
                           onClick={() => { setResolveChecked(false); setShowConfirmResolve(false); }}
                           className="flex-1 py-2.5 bg-slate-50 text-slate-800 font-bold rounded-lg"
                         >
                           Não
                         </button>
                         <button
                           onClick={confirmResolveAction}
                           className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/30"
                         >
                           Sim, Gravar
                         </button>
                     </div>
                 </div>
             </div>
        </div>
      )}

      <div className="relative z-50 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
        
        {isSending && (
          <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center">
            <Loader2 size={48} className="text-primary-400 animate-spin mb-3" />
            <h3 className="text-lg font-bold text-slate-900">Processando...</h3>
            <p className="text-sm text-slate-600 mt-1">Isso pode levar alguns segundos dependendo dos anexos.</p>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 p-4 text-slate-800">
          <div><h3 className="font-bold text-lg flex items-center gap-2">CTE {cte.CTE} <span className="bg-[#2c348c] text-white text-[10px] px-2 py-0.5 rounded-full font-mono">{cte.SERIE}</span></h3><span className="text-xs text-sky-600">Anotações de Mercadoria</span></div>
          <button onClick={() => !isSending && onClose()} disabled={isSending} className="p-1.5 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20}/>
          </button>
        </div>
        
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col gap-2 shrink-0">
             <div className="flex items-center gap-6 text-xs text-slate-600">
                 <div className="flex items-center gap-1.5">
                     <Package size={16} className="text-[#e42424]" />
                     <span>Vol: <strong className="text-slate-900">{liveCte.VOLUMES || '0'}</strong></span>
                 </div>
                 <div className="flex items-center gap-1.5">
                     <Scale size={16} className="text-[#e42424]" />
                     <span>Peso: <strong className="text-slate-900">{liveCte.PESO || '0'}</strong></span>
                 </div>
             </div>
             {hasTxEntrega && (
                 <div className="bg-orange-50 text-orange-700 text-[10px] px-2 py-1 rounded border border-orange-300 flex items-center gap-1 font-bold w-fit">
                    <Coins size={12} /> POSSUI TAXA DE ENTREGA
                 </div>
             )}
        </div>

        {isResolvido ? (
             <div className="bg-emerald-50 p-3 border-b border-emerald-300 flex items-center justify-center shrink-0">
                 <span className="text-xs font-black text-emerald-700 flex items-center gap-2 uppercase"><CheckCircle2 size={16} className="text-emerald-600" /> RESOLVIDO / LOCALIZADA</span>
             </div>
        ) : isCurrentlyEmBusca ? (
             <div className="bg-red-50 p-2 border-b border-red-300 flex items-center justify-center shrink-0">
                 <span className="text-xs font-bold text-red-700 flex items-center gap-2 px-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span> MERCADORIA EM BUSCA</span>
             </div>
        ) : isCurrentlyOcorrencia && (
             <div className="bg-violet-50 p-2 border-b border-violet-300 flex items-center justify-center shrink-0">
                 <span className="text-xs font-bold text-violet-700 flex items-center gap-2 px-2"><Tag size={12} fill="currentColor"/> OCORRÊNCIA ATIVA</span>
             </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
          <div className="space-y-4">
            {currentNotes.length === 0 && <div className="text-center py-10 text-gray-500 italic text-sm">Nenhuma anotação registrada.</div>}
            {currentNotes.map((note, idx) => (
              <div key={idx} className={clsx("flex flex-col p-3 rounded-lg shadow-sm border relative bg-slate-50 border-slate-200 transition-all", note.pending && "opacity-60")}>
                <div className="flex justify-between items-center text-xs text-slate-500 mb-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 font-bold text-[#e42424]">{note.USUARIO}</div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">{note.DATA} {note.pending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={12} className="text-emerald-400" />}</div>
                </div>
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">{note.TEXTO}</p>
                {note.LINK_IMAGEM && (() => {
                  const links = getLinks(note.LINK_IMAGEM);
                  const expanded = !!expandedAttachments[note.ID];
                  const visibleLinks = expanded ? links : links.slice(0, 2);

                  if (links.length === 0) return null;

                  return (
                    <>
                      {visibleLinks.map((link, lIdx) => (
                        <MediaAttachment key={`${note.ID}-${lIdx}`} url={link} onImageClick={setPreviewUrl} />
                      ))}
                      {!expanded && links.length > visibleLinks.length && (
                        <button
                          type="button"
                          onClick={() => setExpandedAttachments(prev => ({ ...prev, [note.ID]: true }))}
                          className="mt-2 w-fit text-[11px] font-bold text-primary-300 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg hover:border-[#e42424] transition-colors"
                        >
                          Ver anexos ({links.length})
                        </button>
                      )}
                    </>
                  );
                })()}
                {note.STATUS_BUSCA === 'EM BUSCA' && <span className="mt-2 inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold border border-red-300 w-fit">EM BUSCA</span>}
                {note.STATUS_BUSCA === 'OCORRENCIA' && <span className="mt-2 inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-[10px] px-2 py-0.5 rounded font-bold border border-violet-300 w-fit">OCORRÊNCIA</span>}
              </div>
            ))}
          </div>
          {sortedProcessHistory.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-3">
                  Histórico de Alterações
                </h4>
                <div className="space-y-2">
                    {sortedProcessHistory.map((p, i) => (
                        <div key={i} className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px] shadow-sm">
                            <div className="flex justify-between font-bold mb-1">
                                <span className={p.STATUS === 'OCORRENCIA' ? 'text-violet-700' : p.STATUS === 'EM BUSCA' ? 'text-red-700' : 'text-emerald-700'}>
                                  {p.STATUS}
                                </span>
                                <span className="text-slate-500">{p.DATA}</span>
                            </div>
                            <div className="text-slate-800 mb-1">{p.USER}</div>
                            {p.DESCRIPTION && <p className="italic text-slate-600">"{p.DESCRIPTION}"</p>}
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>

        {pendingFiles.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-col gap-1 shrink-0">
                <div className="text-[9px] font-bold text-slate-500 uppercase">Arquivos Pendentes ({pendingFiles.length})</div>
                <div className="flex flex-wrap gap-2 py-1">
                    {pendingFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[10px] font-medium text-slate-800 shadow-sm">
                            <FileIcon size={12} className="text-[#e42424]"/> {f.name}
                            <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300 ml-1"><Trash2 size={12}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-4 mb-3">
             {(isCurrentlyEmBusca || isCurrentlyOcorrencia || isResolvido) && (
                 <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-slate-700 group">
                    <div className={clsx(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        resolveChecked ? "bg-emerald-500 border-emerald-500" : "bg-slate-100 border-gray-500 group-hover:border-emerald-400"
                    )}>
                        {resolveChecked && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <input type="checkbox" className="hidden" checked={resolveChecked} onChange={e => { setResolveChecked(e.target.checked); if(e.target.checked) setShowConfirmResolve(true); }} disabled={isResolvido || isSending || !hasPermission('EDIT_NOTES')} />
                    <span>Marcar como <span className="text-emerald-400">{isCurrentlyOcorrencia ? "OCORRÊNCIA ENCERRADA" : "LOCALIZADA"}</span></span>
                </label>
             )}
             {!isResolvido && !isCurrentlyEmBusca && !isCurrentlyOcorrencia && (
                <>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-slate-700 group">
                      <div className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          isSearch ? "bg-red-600 border-red-600" : "bg-slate-100 border-gray-500 group-hover:border-red-500"
                      )}>
                          {isSearch && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={isSearch} onChange={e => { setIsSearch(e.target.checked); if(e.target.checked) setIsOcorrencia(false); }} disabled={isSending || !hasPermission('EDIT_NOTES')} />
                      <span>Marcar <span className="text-red-600">EM BUSCA</span></span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-slate-700 group">
                      <div className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          isOcorrencia ? "bg-violet-600 border-violet-600" : "bg-slate-100 border-gray-500 group-hover:border-violet-500"
                      )}>
                          {isOcorrencia && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={isOcorrencia} onChange={e => { setIsOcorrencia(e.target.checked); if(e.target.checked) setIsSearch(false); }} disabled={isSending || !hasPermission('EDIT_NOTES')} />
                      <span>Marcar <span className="text-violet-700">OCORRÊNCIA</span></span>
                    </label>
                </>
             )}
          </div>
          {isOcorrencia && (
            <div className="mb-2">
              <select
                value={occurrenceType}
                onChange={(e) => setOccurrenceType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
              >
                <option value="AVARIA">Avaria</option>
                <option value="EXTRAVIO">Extravio</option>
                <option value="FALTA_VOLUME">Falta de volume</option>
                <option value="DIVERGENCIA_DOCUMENTAL">Divergência documental/fiscal</option>
                <option value="ATRASO_CRITICO">Atraso crítico</option>
                <option value="TAD_LEGADO">TAD (legado)</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea 
                value={text} onChange={e => setText(e.target.value)} 
                placeholder={isOcorrencia ? "Descreva a ocorrência (obrigatório)..." : "Digite sua observação..."} 
                rows={1} disabled={isSending || !hasPermission('EDIT_NOTES')}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 font-medium outline-none resize-none max-h-[100px] placeholder-gray-500 focus:bg-white focus:ring-2 focus:ring-[#2c348c]/25"
                style={{ fieldSizing: 'content' } as any} 
            />
            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button type="button" onClick={handleUploadClick} disabled={isSending || !hasPermission('EDIT_NOTES')} className={clsx("p-2.5 rounded-full transition-colors", pendingFiles.length > 0 ? "bg-slate-100 text-[#e42424] shadow-sm" : "text-slate-500 hover:bg-slate-100")}><Paperclip size={20} /></button>
            <button type="submit" disabled={isSending || !hasPermission('EDIT_NOTES') || (!text.trim() && pendingFiles.length === 0)} className="rounded-full bg-gradient-to-r from-[#2c348c] to-[#06183e] p-2.5 text-white hover:opacity-95 disabled:opacity-50 shadow-[0_0_18px_rgba(26,27,98,0.8)] active:scale-95 transition-all">
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </div>
    </div>
    <AppMessageModal
      open={!!noteNotice}
      title={noteNotice?.title || ''}
      message={noteNotice?.message || ''}
      variant={noteNotice?.variant || 'info'}
      onClose={() => setNoteNotice(null)}
    />
    </>
  );
};

export default NoteModal;