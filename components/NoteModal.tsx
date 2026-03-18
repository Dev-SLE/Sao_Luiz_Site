import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Paperclip, Loader2, CheckCircle2, Check, History, FileText, Music, Film, ExternalLink, Image as ImageIcon, Trash2, File as FileIcon } from 'lucide-react';
import { CteData, NoteData } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import { Package, Scale, Coins, Tag } from 'lucide-react';
import { authClient } from '../lib/auth';

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
          <div className="media-container drive-container bg-[#070A20] p-2 rounded-lg border border-[#1E226F] mt-2">
               <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-100 font-bold text-xs uppercase tracking-wide">
                      <FileIcon size={14} className="text-primary-400" /> Arquivo no Drive
                  </div>
                  <a href={url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300" title="Abrir em nova aba">
                      <ExternalLink size={14} />
                  </a>
               </div>
               <iframe 
                 src={`https://drive.google.com/file/d/${fileId}/preview`} 
                 className="w-full h-[350px] border border-[#1E226F] rounded bg-[#070A20]"
                 allow="autoplay"
                 title="Drive Preview"
               ></iframe>
          </div>
      );
  }

  if (mimeType.startsWith('image/')) {
     return (
        <div className="mt-2 space-y-2">
            <div className="relative group rounded-lg overflow-hidden border border-[#1E226F] bg-[#070A20] shadow-sm max-w-sm">
                <img 
                    src={url} 
                    alt="Anexo" 
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
  let colorClass = "text-gray-100 bg-[#070A20] border-[#1E226F] hover:bg-[#0F1440]";
  
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
  const { notes, addNote, resolveIssue, baseData, isCteEmBusca, isCteTad, getLatestNote, processControlData, hasPermission } = useData();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isSearch, setIsSearch] = useState(false);
  const [isTad, setIsTad] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolveChecked, setResolveChecked] = useState(false);
  const [showConfirmResolve, setShowConfirmResolve] = useState(false);
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
  const isCurrentlyTad = isCteTad(liveCte.CTE, liveCte.SERIE);
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
          } catch (e) { alert(`Erro ao processar: ${file.name}`); }
      }
      setPendingFiles(prev => [...prev, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => { if (!isSending) setPendingFiles(prev => prev.filter((_, i) => i !== index)); };

  const confirmResolveAction = async () => {
      setShowConfirmResolve(false);
      try { 
          const resolveText = isCurrentlyTad ? "RESOLVIDO: TAD PAGO." : undefined;
          await resolveIssue(cte.CTE, cte.SERIE, resolveText); 
      } catch (err) { setResolveChecked(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && pendingFiles.length === 0) return;
    if (isTad && !text.trim()) { alert("Motivo do TAD é obrigatório."); return; }
    if (!hasPermission('EDIT_NOTES')) {
      alert('Seu perfil não possui permissão para registrar anotações.');
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
      STATUS_BUSCA: isSearch ? 'EM BUSCA' : (isTad ? 'TAD' : ''),
      pending: true,
    };
    setRemoteNotes(prev => {
      const base = Array.isArray(prev) ? prev : [];
      return [optimistic, ...base];
    });
    try {
      const created = await addNote({
        CTE: cte.CTE, SERIE: cte.SERIE || '', CODIGO: cte.CODIGO, DATA: '', 
        USUARIO: user?.username || 'Sistema', TEXTO: text || (pendingFiles.length > 0 ? "Anexo enviado" : ""), 
        LINK_IMAGEM: '', 
        STATUS_BUSCA: isSearch ? 'EM BUSCA' : (isTad ? 'TAD' : ''), 
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
      setText(''); setIsSearch(false); setIsTad(false); setPendingFiles([]);
    } catch (error) {
      setRemoteNotes(prev => {
        const base = Array.isArray(prev) ? prev : [];
        return base.filter(n => n.ID !== tempId);
      });
      alert('Erro ao enviar.');
    } finally { setIsSending(false); }
  };

  const getLinks = (linkStr: string): string[] => {
      if (!linkStr) return [];
      return linkStr.split(/[\s,]+/).filter(l => l.length > 5);
  };

  return (
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
             <div className="bg-[#070A20] p-6 rounded-xl shadow-2xl border border-[#1E226F] w-full max-w-sm text-white">
                 <div className="flex flex-col items-center text-center">
                     <div className="w-12 h-12 bg-emerald-900/70 rounded-full flex items-center justify-center text-emerald-300 mb-4">
                       <Check size={28} />
                     </div>
                     <h3 className="text-lg font-bold mb-2">
                         {isCurrentlyTad ? 'Confirmar TAD PAGO?' : 'Gravar como Localizada?'}
                     </h3>
                     <p className="text-sm text-gray-300 mb-6">
                       O status mudará para <strong className="text-emerald-300">RESOLVIDO</strong>.
                     </p>
                     <div className="flex gap-3 w-full">
                         <button
                           onClick={() => { setResolveChecked(false); setShowConfirmResolve(false); }}
                           className="flex-1 py-2.5 bg-[#080816] text-gray-100 font-bold rounded-lg"
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

      <div className="bg-[#070A20] w-full max-w-lg rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col max-h-[90vh] border border-[#1E226F] relative z-50 text-white">
        
        {isSending && (
          <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center">
            <Loader2 size={48} className="text-primary-400 animate-spin mb-3" />
            <h3 className="text-lg font-bold text-white">Processando...</h3>
            <p className="text-sm text-gray-300 mt-1">Isso pode levar alguns segundos dependendo dos anexos.</p>
          </div>
        )}

        <div className="bg-[#080816] p-4 text-white flex justify-between items-center shrink-0 border-b border-[#1A1B62]">
          <div><h3 className="font-bold text-lg flex items-center gap-2">CTE {cte.CTE} <span className="bg-primary-700 text-[10px] px-2 py-0.5 rounded-full font-mono">{cte.SERIE}</span></h3><span className="text-xs text-primary-200">Anotações de Mercadoria</span></div>
          <button onClick={() => !isSending && onClose()} disabled={isSending} className="p-1.5 rounded-full hover:bg-primary-700 transition-colors">
            <X size={20}/>
          </button>
        </div>
        
        <div className="bg-[#070A20] border-b border-[#1E226F] px-4 py-3 flex flex-col gap-2 shrink-0">
             <div className="flex items-center gap-6 text-xs text-gray-300">
                 <div className="flex items-center gap-1.5">
                     <Package size={16} className="text-[#EC1B23]" />
                     <span>Vol: <strong className="text-white">{liveCte.VOLUMES || '0'}</strong></span>
                 </div>
                 <div className="flex items-center gap-1.5">
                     <Scale size={16} className="text-[#EC1B23]" />
                     <span>Peso: <strong className="text-white">{liveCte.PESO || '0'}</strong></span>
                 </div>
             </div>
             {hasTxEntrega && (
                 <div className="bg-orange-900/60 text-orange-200 text-[10px] px-2 py-1 rounded border border-orange-400/70 flex items-center gap-1 font-bold w-fit animate-pulse">
                    <Coins size={12} /> POSSUI TAXA DE ENTREGA
                 </div>
             )}
        </div>

        {isResolvido ? (
             <div className="bg-emerald-900/70 p-3 border-b border-emerald-500/70 flex items-center justify-center shrink-0">
                 <span className="text-xs font-black text-emerald-100 flex items-center gap-2 uppercase"><CheckCircle2 size={16} className="text-emerald-300" /> RESOLVIDO / LOCALIZADA</span>
             </div>
        ) : isCurrentlyEmBusca ? (
             <div className="bg-red-900/60 p-2 border-b border-red-500/70 flex items-center justify-center shrink-0">
                 <span className="text-xs font-bold text-red-100 flex items-center gap-2 px-2"><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_6px_rgba(248,113,113,0.9)]"></span> MERCADORIA EM BUSCA</span>
             </div>
        ) : isCurrentlyTad && (
             <div className="bg-violet-900/60 p-2 border-b border-violet-500/70 flex items-center justify-center shrink-0">
                 <span className="text-xs font-bold text-violet-100 flex items-center gap-2 px-2"><Tag size={12} fill="currentColor"/> PROCESSO DE TAD</span>
             </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#070A20]">
          <div className="space-y-4">
            {currentNotes.length === 0 && <div className="text-center py-10 text-gray-500 italic text-sm">Nenhuma anotação registrada.</div>}
            {currentNotes.map((note, idx) => (
              <div key={idx} className={clsx("flex flex-col p-3 rounded-lg shadow-sm border relative bg-[#080816] border-[#1A1B62] transition-all", note.pending && "opacity-60")}>
                <div className="flex justify-between items-center text-xs text-gray-400 mb-2 pb-2 border-b border-[#1A1B62]">
                  <div className="flex items-center gap-1.5 font-bold text-[#EC1B23]">{note.USUARIO}</div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-gray-400">{note.DATA} {note.pending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={12} className="text-emerald-400" />}</div>
                </div>
                <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap font-medium">{note.TEXTO}</p>
                {note.LINK_IMAGEM && getLinks(note.LINK_IMAGEM).map((link, lIdx) => (
                    <MediaAttachment key={lIdx} url={link} onImageClick={setPreviewUrl} />
                ))}
                {note.STATUS_BUSCA === 'EM BUSCA' && <span className="mt-2 inline-flex items-center gap-1 bg-red-900/60 text-red-100 text-[10px] px-2 py-0.5 rounded font-bold border border-red-500/70 w-fit">EM BUSCA</span>}
                {note.STATUS_BUSCA === 'TAD' && <span className="mt-2 inline-flex items-center gap-1 bg-violet-900/60 text-violet-100 text-[10px] px-2 py-0.5 rounded font-bold border border-violet-500/70 w-fit">TAD</span>}
              </div>
            ))}
          </div>
          {sortedProcessHistory.length > 0 && (
            <div className="border-t border-[#1A1B62] pt-4">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 mb-3">
                  Histórico de Alterações
                </h4>
                <div className="space-y-2">
                    {sortedProcessHistory.map((p, i) => (
                        <div key={i} className="bg-[#080816] p-2 rounded border border-[#1A1B62] text-[11px] shadow-sm">
                            <div className="flex justify-between font-bold mb-1">
                                <span className={p.STATUS === 'TAD' ? 'text-violet-300' : p.STATUS === 'EM BUSCA' ? 'text-red-300' : 'text-emerald-300'}>
                                  {p.STATUS}
                                </span>
                                <span className="text-gray-400">{p.DATA}</span>
                            </div>
                            <div className="text-gray-100 mb-1">{p.USER}</div>
                            {p.DESCRIPTION && <p className="italic text-gray-300">"{p.DESCRIPTION}"</p>}
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>

        {pendingFiles.length > 0 && (
            <div className="px-4 py-2 bg-[#080816] border-t border-[#1A1B62] flex flex-col gap-1 shrink-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase">Arquivos Pendentes ({pendingFiles.length})</div>
                <div className="flex flex-wrap gap-2 py-1">
                    {pendingFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 bg-[#0B0F2A] px-2 py-1 rounded border border-[#1E226F] text-[10px] font-medium text-gray-100 shadow-sm">
                            <FileIcon size={12} className="text-[#EC1B23]"/> {f.name}
                            <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300 ml-1"><Trash2 size={12}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 bg-[#070A20] border-t border-[#1E226F] shrink-0">
          <div className="flex items-center gap-4 mb-3">
             {(isCurrentlyEmBusca || isCurrentlyTad || isResolvido) && (
                 <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-gray-200 group">
                    <div className={clsx(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        resolveChecked ? "bg-emerald-500 border-emerald-500" : "bg-[#0B0F2A] border-gray-500 group-hover:border-emerald-400"
                    )}>
                        {resolveChecked && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <input type="checkbox" className="hidden" checked={resolveChecked} onChange={e => { setResolveChecked(e.target.checked); if(e.target.checked) setShowConfirmResolve(true); }} disabled={isResolvido || isSending || !hasPermission('EDIT_NOTES')} />
                    <span>Marcar como <span className="text-emerald-400">{isCurrentlyTad ? "TAD PAGO" : "LOCALIZADA"}</span></span>
                </label>
             )}
             {!isResolvido && !isCurrentlyEmBusca && !isCurrentlyTad && (
                <>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-gray-200 group">
                      <div className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          isSearch ? "bg-red-600 border-red-600" : "bg-[#0B0F2A] border-gray-500 group-hover:border-red-500"
                      )}>
                          {isSearch && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={isSearch} onChange={e => { setIsSearch(e.target.checked); if(e.target.checked) setIsTad(false); }} disabled={isSending || !hasPermission('EDIT_NOTES')} />
                      <span>Marcar <span className="text-red-400">EM BUSCA</span></span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-gray-200 group">
                      <div className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          isTad ? "bg-violet-600 border-violet-600" : "bg-[#0B0F2A] border-gray-500 group-hover:border-violet-500"
                      )}>
                          {isTad && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={isTad} onChange={e => { setIsTad(e.target.checked); if(e.target.checked) setIsSearch(false); }} disabled={isSending || !hasPermission('EDIT_NOTES')} />
                      <span>Marcar <span className="text-violet-300">TAD</span></span>
                    </label>
                </>
             )}
          </div>
          <div className="flex gap-2 items-end">
            <textarea 
                value={text} onChange={e => setText(e.target.value)} 
                placeholder={isTad ? "Descreva o motivo do TAD (Obrigatório)..." : "Digite sua observação..."} 
                rows={1} disabled={isSending || !hasPermission('EDIT_NOTES')}
                className="flex-1 bg-[#0B0F2A] border border-[#1E226F] rounded-2xl px-4 py-2.5 text-sm text-gray-100 font-medium outline-none resize-none max-h-[100px] placeholder-gray-500 focus:bg-[#0F1440] focus:ring-1 focus:ring-[#EC1B23]"
                style={{ fieldSizing: 'content' } as any} 
            />
            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button type="button" onClick={handleUploadClick} disabled={isSending || !hasPermission('EDIT_NOTES')} className={clsx("p-2.5 rounded-full transition-colors", pendingFiles.length > 0 ? "bg-[#0F103A] text-[#EC1B23] shadow-sm" : "text-gray-400 hover:bg-[#0F103A]")}><Paperclip size={20} /></button>
            <button type="submit" disabled={isSending || !hasPermission('EDIT_NOTES') || (!text.trim() && pendingFiles.length === 0)} className="bg-[#1A1B62] text-white p-2.5 rounded-full hover:bg-[#EC1B23] disabled:opacity-50 shadow-[0_0_18px_rgba(26,27,98,0.8)] active:scale-95 transition-all">
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;