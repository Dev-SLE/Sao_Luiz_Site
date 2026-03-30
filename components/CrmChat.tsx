import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  MessageCircle,
  Phone,
  Paperclip,
  Smile,
  Send,
  UserCircle2,
  Hash,
  Filter,
  MessageSquare,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
  MapPin,
} from 'lucide-react';
import clsx from 'clsx';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../lib/auth';
import { AppConfirmModal, AppMessageModal, type AppMessageVariant } from './AppOverlays';

type Channel = 'WHATSAPP' | 'IA' | 'INTERNO';

interface ConversationSummary {
  id: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
  leadAvatarUrl?: string | null;
  cte?: string | null;
  leadId?: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  channel: Channel;
  priority: 'ALTA' | 'MEDIA' | 'BAIXA';
  status?: 'PENDENTE' | 'CONCLUIDO' | 'EM_RASTREIO' | 'PERDIDO' | string;
  assignedUsername?: string | null;
  assignedTeamId?: string | null;
  assignmentMode?: 'AUTO' | 'MANUAL' | string;
  lockedBy?: string | null;
  topic?: string | null;
  slaDueAt?: string | null;
  slaBreachedAt?: string | null;
  protocolNumber?: string | null;
  routeOrigin?: string | null;
  routeDestination?: string | null;
  requestedAt?: string | null;
  serviceType?: string | null;
  cargoStatus?: string | null;
  customerStatus?: string | null;
  source?: string | null;
  currentLocation?: string | null;
  ownerUsername?: string | null;
  isRecurringFreight?: boolean;
  trackingActive?: boolean;
  observations?: string | null;
  aiSummary?: string | null;
  aiSummaryUpdatedAt?: string | null;
  /** Caixa WhatsApp (null = linha oficial Meta / Sofia) */
  inboxName?: string | null;
  inboxProvider?: string | null;
}

interface Message {
  id: string;
  from: 'CLIENTE' | 'AGENTE' | 'IA';
  fromLabel?: string;
  text: string;
  time: string;
  channel: Channel;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  edited?: boolean;
  attachments?: Array<{ type?: string; filename?: string | null }>;
  optimistic?: boolean;
  replyTo?: { messageId?: string; sender?: string; text?: string } | null;
  deleted?: boolean;
  createdAt?: string | null;
}

interface RelatedLeadHistoryItem {
  messageId: string;
  conversationId: string;
  body: string;
  senderType: 'CLIENTE' | 'AGENTE' | 'IA' | string;
  channel: Channel | string;
  inboxName?: string | null;
  createdAt: string;
  time: string;
}

const channelConfig: Record<Channel, { label: string; className: string }> = {
  WHATSAPP: {
    label: 'WhatsApp',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  IA: {
    label: 'IA',
    className: 'bg-sky-50 text-sky-700 border-sky-300',
  },
  INTERNO: {
    label: 'Interno',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

function getChannelUi(channelRaw: unknown): { label: string; className: string } {
  const key = String(channelRaw || "").toUpperCase() as Channel;
  return channelConfig[key] || channelConfig.WHATSAPP;
}

/** Proxy local evita bloqueio de hotlink (pps.whatsapp.net) no navegador. */
function profilePhotoSrc(url: string | null | undefined): string | null {
  const u = String(url || '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return null;
  return `/api/crm/profile-photo?u=${encodeURIComponent(u)}`;
}

function LeadAvatar({
  url,
  name,
  size = 26,
  active,
}: {
  url?: string | null;
  name: string;
  size?: number;
  active?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const src = !failed && url ? profilePhotoSrc(url) : null;
  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={`Foto de ${name}`}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="rounded-full border border-slate-200 object-cover"
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <UserCircle2
          size={size}
          className={active ? 'text-[#e42424]' : 'text-[#2c348c]/70'}
        />
      )}
    </div>
  );
}

/** Linha única tipo "[Áudio recebido]" vinda do webhook — mostramos só o cartão, sem repetir o texto. */
function isSingleLinePlaceholder(text: string): boolean {
  const t = String(text || '').trim();
  return /^\[[^\]]+\]$/.test(t) && t.length < 120;
}

function MediaPlaceholderHint({ text, isMe }: { text: string; isMe: boolean }) {
  const t = String(text || '');
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  let icon = <Paperclip size={14} className="shrink-0 opacity-90" />;
  if (t.includes('Áudio')) icon = <Mic size={14} className="shrink-0 opacity-90" />;
  else if (t.includes('Imagem')) icon = <ImageIcon size={14} className="shrink-0 opacity-90" />;
  else if (t.includes('Vídeo')) icon = <Video size={14} className="shrink-0 opacity-90" />;
  else if (t.includes('Documento')) icon = <FileText size={14} className="shrink-0 opacity-90" />;
  else if (t.includes('Localização')) icon = <MapPin size={14} className="shrink-0 opacity-90" />;
  const label = t.replace(/^\[|\]$/g, '');
  return (
    <div
      className={clsx(
        'mb-1.5 flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] border',
        isMe
          ? 'border-white/25 bg-white/10 text-white'
          : 'border-slate-200 bg-slate-50 text-slate-700'
      )}
    >
      {icon}
      <span className="font-medium leading-tight">{label}</span>
    </div>
  );
}

const mockConversations: ConversationSummary[] = [
  {
    id: '1',
    leadName: 'Mercado Central LTDA',
    lastMessage: 'Motorista já saiu para entrega, previsão 14h.',
    lastAt: '13:02',
    unread: 2,
    channel: 'WHATSAPP',
    priority: 'ALTA',
  },
  {
    id: '2',
    leadName: 'Distribuidora Norte',
    lastMessage: 'IA: Cotação atualizada para o novo trajeto.',
    lastAt: 'Ontem',
    unread: 0,
    channel: 'IA',
    priority: 'MEDIA',
  },
  {
    id: '3',
    leadName: 'Cliente Walk-in',
    lastMessage: 'Perfeito, aguardo confirmação do horário.',
    lastAt: '09:15',
    unread: 0,
    channel: 'INTERNO',
    priority: 'BAIXA',
  },
];

const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1',
      from: 'CLIENTE',
      text: 'Bom dia, já saiu para entrega?',
      time: '12:55',
      channel: 'WHATSAPP',
    },
    {
      id: 'm2',
      from: 'AGENTE',
      text: 'Bom dia! Já está em rota, previsão de chegada entre 14h e 15h.',
      time: '13:00',
      channel: 'WHATSAPP',
    },
    {
      id: 'm3',
      from: 'CLIENTE',
      text: 'Ok, obrigado 🙏',
      time: '13:02',
      channel: 'WHATSAPP',
    },
  ],
  '2': [
    {
      id: 'm4',
      from: 'IA',
      text: 'Sugestão de rota otimizada com redução de 8% no custo do frete.',
      time: 'Ontem',
      channel: 'IA',
    },
  ],
  '3': [
    {
      id: 'm5',
      from: 'AGENTE',
      text: 'Podemos agendar a coleta para amanhã de manhã.',
      time: '09:05',
      channel: 'INTERNO',
    },
    {
      id: 'm6',
      from: 'CLIENTE',
      text: 'Perfeito, aguardo confirmação do horário.',
      time: '09:15',
      channel: 'INTERNO',
    },
  ],
};

interface Props {
  leadId?: string | null;
  onOpenTracking?: (cte: string, serie?: string) => void;
}

let crmChatCache: {
  leadId: string | null;
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  messagesByConversation: Record<string, Message[]>;
  messagesUpdatedAtByConversation: Record<string, number>;
  savedAt: number;
} | null = null;

const READ_SIG_STORAGE_KEY = 'sle_chat_read_signatures';

function humanizeGovernanceReason(reason: string): string {
  const r = String(reason || '').trim();
  const map: Record<string, string> = {
    keyword_detected: 'palavra-chave de handoff',
    governance_blocked: 'regras de segurança',
    assistido_mode: 'modo assistido (sem envio automático)',
    semi_auto_requires_human_confirm: 'é necessário confirmar antes do envio',
    outside_active_day: 'fora dos dias configurados para a Sofia',
    outside_business_hours: 'fora do horário comercial',
    low_confidence: 'baixa confiança da resposta',
    max_auto_replies_reached: 'limite de respostas automáticas atingido',
    blocked_topic: 'tema bloqueado pela política',
    blocked_status: 'status do atendimento não permite envio automático',
    agency_waiting_human_followup: 'fluxo de agência aguarda humano',
    agency_sla_breached: 'SLA de agência',
    sla_breached: 'SLA do atendimento',
    too_many_customer_messages_without_human: 'várias mensagens do cliente sem resposta humana',
    ok: 'ok',
  };
  return map[r] || r.replace(/_/g, ' ');
}

const CrmChat: React.FC<Props> = ({ leadId, onOpenTracking }) => {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [relatedLeadHistory, setRelatedLeadHistory] = useState<RelatedLeadHistoryItem[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [clientePhone, setClientePhone] = useState('(11) 99999-0000');
  const [clienteEmail, setClienteEmail] = useState('contato@cliente.com.br');
  const [observacoes, setObservacoes] = useState(
    'Cliente estratégico com alto volume mensal de envios.'
  );
  const [freteRecorrente, setFreteRecorrente] = useState(false);
  const [rastreioAtivo, setRastreioAtivo] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ messageId: string; sender: string; text: string } | null>(null);
  const [infoTab, setInfoTab] = useState<'detalhes' | 'midia' | 'resumo'>('detalhes');
  const [statusAtendimento, setStatusAtendimento] = useState<
    'PENDENTE' | 'CONCLUIDO' | 'EM_RASTREIO' | 'PERDIDO'
  >('PENDENTE');
  const [agents, setAgents] = useState<Array<{ username: string; role?: string; activeConversations?: number }>>([]);
  const [crmScope, setCrmScope] = useState<'ALL' | 'TEAM' | 'SELF' | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [routingHint, setRoutingHint] = useState<{ topic?: string; targetUsername?: string | null } | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [clienteDestino, setClienteDestino] = useState('');
  const [clientePreferencia, setClientePreferencia] = useState<'WHATSAPP' | 'LIGACAO' | 'EMAIL'>('WHATSAPP');
  const [leadProtocol, setLeadProtocol] = useState('');
  const [leadRouteOrigin, setLeadRouteOrigin] = useState('');
  const [leadRequestedAt, setLeadRequestedAt] = useState('');
  const [leadServiceType, setLeadServiceType] = useState('ATENDIMENTO_GERAL');
  const [leadCargoStatus, setLeadCargoStatus] = useState('SEM_STATUS');
  const [leadCustomerStatus, setLeadCustomerStatus] = useState('PENDENTE');
  const [leadSource, setLeadSource] = useState<'WHATSAPP' | 'IA' | 'MANUAL'>('MANUAL');
  const [leadPriority, setLeadPriority] = useState<'ALTA' | 'MEDIA' | 'BAIXA'>('MEDIA');
  const [leadCurrentLocation, setLeadCurrentLocation] = useState('');
  const [sofiaSuggesting, setSofiaSuggesting] = useState(false);
  const [sofiaAutoRunning, setSofiaAutoRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [ultimoRastreio, setUltimoRastreio] = useState<string | null>(null);
  const [sofiaName, setSofiaName] = useState('Sofia');
  const [sofiaWelcome, setSofiaWelcome] = useState(
    'Olá! Sou a Sofia, assistente virtual da São Luiz Express. Como posso te ajudar hoje?'
  );
  const [sofiaActiveToday, setSofiaActiveToday] = useState<boolean>(true);
  const [sofiaGenerateSummaryEnabled, setSofiaGenerateSummaryEnabled] = useState<boolean>(true);
  const [savingClientData, setSavingClientData] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [readSignatures, setReadSignatures] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(READ_SIG_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pulseUnreadByConversationId, setPulseUnreadByConversationId] = useState<Record<string, boolean>>({});
  const [appNotice, setAppNotice] = useState<{
    title: string;
    message: string;
    variant: AppMessageVariant;
  } | null>(null);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const autoReplyGuardRef = useRef<string>('');
  const conversationsFetchLock = useRef(false);
  const conversationsPollInFlight = useRef(false);
  const messagesRequestSeq = useRef(0);

  const applyMessagesResponse = (resp: any) => {
    setMessages((resp?.messages || []) as Message[]);
    setRelatedLeadHistory(
      Array.isArray(resp?.relatedLeadHistory)
        ? (resp.relatedLeadHistory as RelatedLeadHistoryItem[])
        : []
    );
  };

  const scrollMessagesToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useLayoutEffect(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 168; // ~7 linhas
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [input]);

  const { pendencias, criticos, fullData } = useData();

  const selectedConversation = useMemo(() => {
    if (!conversations.length) return null;
    if (selectedConversationId) {
      return conversations.find((c) => c.id === selectedConversationId) || conversations[0];
    }
    return conversations[0];
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(READ_SIG_STORAGE_KEY, JSON.stringify(readSignatures));
    } catch {
      // noop
    }
  }, [readSignatures]);

  const effectiveUnreadByConversationId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const conv of conversations) {
      const sig = `${conv.lastAt || ''}|${conv.lastMessage || ''}`;
      const readSig = readSignatures[conv.id];
      map[conv.id] = conv.unread > 0 && readSig !== sig ? conv.unread : 0;
    }
    return map;
  }, [conversations, readSignatures]);

  const prevEffectiveUnreadRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const prev = prevEffectiveUnreadRef.current;
    const nextPulse: Record<string, boolean> = {};
    for (const conv of conversations) {
      const prevCount = prev[conv.id] || 0;
      const nextCount = effectiveUnreadByConversationId[conv.id] || 0;
      if (nextCount > prevCount && conv.id !== selectedConversationId) {
        nextPulse[conv.id] = true;
      }
    }
    if (Object.keys(nextPulse).length > 0) {
      setPulseUnreadByConversationId((current) => ({ ...current, ...nextPulse }));
      window.setTimeout(() => {
        setPulseUnreadByConversationId((current) => {
          const updated = { ...current };
          for (const id of Object.keys(nextPulse)) delete updated[id];
          return updated;
        });
      }, 2200);
    }
    prevEffectiveUnreadRef.current = effectiveUnreadByConversationId;
  }, [conversations, effectiveUnreadByConversationId, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const conv = conversations.find((c) => c.id === selectedConversationId);
    if (!conv) return;
    const sig = `${conv.lastAt || ''}|${conv.lastMessage || ''}`;
    setReadSignatures((prev) => (prev[selectedConversationId] === sig ? prev : { ...prev, [selectedConversationId]: sig }));
  }, [selectedConversationId, conversations]);

  useEffect(() => {
    const t = window.setTimeout(() => scrollMessagesToBottom(), 30);
    return () => window.clearTimeout(t);
  }, [selectedConversationId, messages.length]);

  const conversationPreviewSigRef = useRef<string>('');

  useEffect(() => {
    conversationPreviewSigRef.current = '';
  }, [selectedConversationId]);

  // Quando o preview da lista muda (nova msg no banco), sincroniza o painel sem esperar o polling.
  useEffect(() => {
    if (!selectedConversationId || !selectedConversation) return;
    const sig = `${selectedConversationId}|${selectedConversation.lastMessage || ''}|${selectedConversation.lastAt || ''}`;
    if (conversationPreviewSigRef.current === sig) return;
    conversationPreviewSigRef.current = sig;
    let cancelled = false;
    const run = async () => {
      try {
        const reqSeq = ++messagesRequestSeq.current;
        const msgsResp = await authClient.getCrmMessages(selectedConversationId);
        const next = msgsResp?.messages || [];
        if (cancelled || reqSeq !== messagesRequestSeq.current) return;
        applyMessagesResponse(msgsResp);
        crmChatCache = {
          leadId: leadId || null,
          conversations: crmChatCache?.conversations || [],
          selectedConversationId,
          messagesByConversation: {
            ...(crmChatCache?.messagesByConversation || {}),
            [selectedConversationId]: next,
          },
          messagesUpdatedAtByConversation: {
            ...(crmChatCache?.messagesUpdatedAtByConversation || {}),
            [selectedConversationId]: Date.now(),
          },
          savedAt: Date.now(),
        };
      } catch {
        // noop
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [leadId, selectedConversation, selectedConversationId]);

  const destinationUnits = useMemo(() => {
    const set = new Set<string>();
    for (const row of fullData || []) {
      if (row?.ENTREGA) set.add(String(row.ENTREGA));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [fullData]);

  useEffect(() => {
    if (!selectedConversation) return;
    setStatusAtendimento(
      (selectedConversation.status as any) || 'PENDENTE'
    );
  }, [selectedConversation?.id]);

  const handleSaveClientData = async () => {
    if (!selectedConversation?.leadId) return;
    if (savingClientData) return;
    setSavingClientData(true);
    try {
      await authClient.updateCrmLead({
        leadId: selectedConversation.leadId,
        title: selectedConversation.leadName || 'Lead',
        phone: clientePhone || null,
        email: clienteEmail || null,
        protocolNumber: leadProtocol || null,
        routeOrigin: leadRouteOrigin || null,
        routeDestination: clienteDestino || null,
        requestedAt: leadRequestedAt || null,
        serviceType: leadServiceType || null,
        cargoStatus: leadCargoStatus || null,
        customerStatus: leadCustomerStatus || null,
        source: leadSource,
        priority: leadPriority,
        currentLocation: leadCurrentLocation || null,
        observations: observacoes,
        isRecurringFreight: freteRecorrente,
        trackingActive: rastreioAtivo,
        updatedByUsername: user?.username ?? null,
      });
    } catch (e) {
      console.error('Erro ao salvar dados do cliente:', e);
    } finally {
      setSavingClientData(false);
    }
  };

  const lookupCte = (cteRaw: string) => {
    const normalized = cteRaw.replace(/\D/g, '');
    if (!normalized) return null;
    const all = [...pendencias.data, ...criticos.data];
    const found = all.find((c) => c.CTE.replace(/\D/g, '') === normalized);
    if (!found) return null;
    // Atualiza contador de rastreios automáticos da Sofia (localStorage)
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('sofiaCteLookups');
        const today = new Date().toISOString().slice(0, 10);
        let current = { date: today, count: 0 };
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.date === today) current = parsed;
        }
        current.count = (current.count || 0) + 1;
        window.localStorage.setItem('sofiaCteLookups', JSON.stringify(current));
      }
    } catch {
      // ignore
    }
    const status = found.STATUS_CALCULADO || found.STATUS || 'Sem status';
    const unidade = found.ENTREGA || '—';
    const dataLimite = found.DATA_LIMITE_BAIXA || '—';
    return `CTE ${found.CTE} • ${unidade} • ${status} • Limite ${dataLimite}`;
  };

  const handleSend = async () => {
    if (!input.trim() && attachmentFiles.length === 0) return;
    const text = input.trim();

    const matches = text.match(/\b\d{4,}\b/g);
    if (matches && matches.length > 0) {
      for (const raw of matches) {
        const info = lookupCte(raw);
        if (info) {
          setUltimoRastreio(info);
          break;
        }
      }
    }

    const channel = (selectedConversation?.channel as any) || "WHATSAPP";
    const leadForSend = leadId ?? selectedConversation?.leadId ?? null;

    // Envia para o backend (Neon/PG) e recarrega mensagens.
    try {
      setInput('');
      setSendingAttachment(true);
      let attachmentsPayload: Array<{ type?: string; filename?: string; url?: string }> = [];
      if (attachmentFiles.length > 0) {
        for (const file of attachmentFiles) {
          const fd = new FormData();
          fd.append('file', file, file.name);
          fd.append('username', user?.username || '');
          const up = await fetch('/api/uploadImage', { method: 'POST', body: fd });
          const upJson = await up.json().catch(() => ({}));
          if (up.ok && upJson?.downloadUrl) {
            attachmentsPayload.push({
              type: file.type || 'application/octet-stream',
              filename: file.name,
              url: String(upJson.downloadUrl),
            });
          }
        }
      }
      const optimisticMessage: Message = {
        id: `tmp-${Date.now()}`,
        from: 'AGENTE',
        text: text || '[Anexo]',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        channel: channel as Channel,
        status: 'pending',
        optimistic: true,
        attachments: attachmentsPayload,
        replyTo: replyTarget
          ? {
              messageId: replyTarget.messageId,
              sender: replyTarget.sender,
              text: replyTarget.text,
            }
          : null,
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      const resp = await authClient.sendCrmMessage({
        conversationId: selectedConversationId,
        leadId: leadForSend,
        channel,
        senderType: 'AGENTE',
        body: text,
        senderUsername: user?.username ?? null,
        attachments: attachmentsPayload,
        replyTo: replyTarget
          ? {
              messageId: replyTarget.messageId,
              sender: replyTarget.sender,
              text: replyTarget.text,
            }
          : null,
      });

      const nextConversationId = resp?.conversationId || selectedConversationId;
      if (nextConversationId) {
        const msgsResp = await authClient.getCrmMessages(nextConversationId);
        applyMessagesResponse(msgsResp);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === nextConversationId ? { ...c, lastMessage: text, lastAt: 'agora' } : c
        )
      );
      if (nextConversationId) setSelectedConversationId(nextConversationId);
      setAttachmentFiles([]);
      setReplyTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Erro ao enviar mensagem CRM:', err);
      // Mantém input se falhar para o usuário reenviar.
      setMessages((prev) => prev.filter((m) => !m.optimistic));
      setInput(text);
    } finally {
      setSendingAttachment(false);
    }
  };

  const applyConversationUpdate = async (payload: any) => {
    if (!selectedConversationId) return;
    if (assigning) return;
    setAssigning(true);
    try {
      await authClient.updateCrmConversation({
        conversationId: selectedConversationId,
        ...payload,
      });
      const convResp = await authClient.getCrmConversations({
        leadId: leadId || null,
        requestUsername: user?.username || null,
        requestRole: user?.role || null,
      });
      setCrmScope(convResp?.scope ?? 'SELF');
      setConversations(convResp?.conversations || []);
    } catch (e) {
      console.error("Erro ao atualizar conversa:", e);
    } finally {
      setAssigning(false);
    }
  };

  const handleSofiaSuggest = async () => {
    if (!selectedConversationId) return;
    if (sofiaSuggesting) return;
    setSofiaSuggesting(true);
    try {
      const suggestion = await authClient.getSofiaReplySuggestion({
        conversationId: selectedConversationId,
        text: input || (selectedConversation?.lastMessage || ''),
      });
      if (suggestion?.suggestion) {
        setInput(String(suggestion.suggestion));
      }
    } catch (e) {
      console.error("Erro ao pedir sugestão da Sofia:", e);
    } finally {
      setSofiaSuggesting(false);
    }
  };

  const handleSofiaAutoReply = async () => {
    if (!selectedConversationId) return;
    if (sofiaAutoRunning) return;
    setSofiaAutoRunning(true);
    try {
      const resp = await authClient.getSofiaReplySuggestion({
        conversationId: selectedConversationId,
        text: input || (selectedConversation?.lastMessage || ''),
      });

      const suggestionText = String(resp?.suggestion || '').trim();
      if (!suggestionText) {
        setAppNotice({
          title: 'Sofia',
          message: 'Não foi possível gerar uma resposta para este contexto. Tente ajustar a mensagem ou o resumo.',
          variant: 'warning',
        });
        return;
      }

      const allowAuto = !!resp?.governance?.allowAutoSend;
      if (!allowAuto) {
        if (resp?.governance?.reason === 'keyword_detected' && suggestionText) {
          const leadForSend = leadId ?? selectedConversation?.leadId ?? null;
          await authClient.sendCrmMessage({
            conversationId: selectedConversationId,
            leadId: leadForSend,
            channel: (selectedConversation?.channel as any) || 'WHATSAPP',
            senderType: 'IA',
            body: suggestionText,
            senderUsername: sofiaName || 'Sofia',
          });
          const msgsResp = await authClient.getCrmMessages(selectedConversationId);
          applyMessagesResponse(msgsResp);
          setInput('');
          setAppNotice({
            title: 'Handoff para atendimento humano',
            message:
              'Palavra-chave de handoff detectada. A mensagem foi enviada e a Sofia deixa de responder automaticamente neste fluxo; continue o atendimento manualmente.',
            variant: 'success',
          });
          return;
        }
        const reason = String(resp?.governance?.reason || 'governance_blocked');
        setInput(suggestionText);
        setAppNotice({
          title: 'Governança da Sofia',
          message: `O envio automático foi bloqueado (${humanizeGovernanceReason(reason)}). A sugestão foi colocada no campo de mensagem para você revisar e enviar manualmente.`,
          variant: 'warning',
        });
        return;
      }

      const leadForSend = leadId ?? selectedConversation?.leadId ?? null;
      await authClient.sendCrmMessage({
        conversationId: selectedConversationId,
        leadId: leadForSend,
        channel: (selectedConversation?.channel as any) || 'WHATSAPP',
        senderType: 'IA',
        body: suggestionText,
        senderUsername: sofiaName || 'Sofia',
      });

      const msgsResp = await authClient.getCrmMessages(selectedConversationId);
      applyMessagesResponse(msgsResp);
      setInput('');
      setAppNotice({
        title: 'Mensagem enviada',
        message: 'A Sofia enviou a resposta automaticamente. As regras de governança foram respeitadas.',
        variant: 'success',
      });
    } catch (e) {
      console.error("Erro ao executar auto resposta da Sofia:", e);
      setAppNotice({
        title: 'Auto resposta',
        message: 'Não foi possível concluir a ação. Verifique sua conexão e tente novamente.',
        variant: 'error',
      });
    } finally {
      setSofiaAutoRunning(false);
    }
  };

  useEffect(() => {
    // Prioriza CTE salvo no lead (webhook / Sofia); senão extrai do histórico (4+ dígitos).
    const fromLead = selectedConversation?.cte?.replace(/\D/g, "") || "";
    if (fromLead.length >= 4) {
      const info = lookupCte(fromLead);
      setUltimoRastreio(
        info || `CTE ${fromLead} vinculado ao lead — abra o rastreio para ver detalhes operacionais.`
      );
      return;
    }

    if (!messages.length) {
      setUltimoRastreio(null);
      return;
    }

    const allText = messages.map((m) => m.text).join(" ");
    const matches = allText.match(/\b\d{4,}\b/g);
    if (matches && matches.length > 0) {
      for (const raw of matches) {
        const info = lookupCte(raw);
        if (info) {
          setUltimoRastreio(info);
          return;
        }
      }
    }

    setUltimoRastreio(null);
  }, [messages, selectedConversation?.cte, selectedConversation?.id, pendencias.data, criticos.data]);

  useEffect(() => {
    if (
      crmChatCache &&
      crmChatCache.leadId === (leadId || null) &&
      Date.now() - crmChatCache.savedAt < 300_000
    ) {
      setConversations(crmChatCache.conversations);
      setSelectedConversationId(crmChatCache.selectedConversationId);
      if (crmChatCache.selectedConversationId) {
        setMessages(crmChatCache.messagesByConversation[crmChatCache.selectedConversationId] || []);
        setRelatedLeadHistory([]);
      }
    }

    let cancelled = false;
    const run = async () => {
      if (conversationsFetchLock.current) return;
      conversationsFetchLock.current = true;
      setConversationsLoading(true);
      try {
        const resp = await authClient.getCrmConversations({
          leadId: leadId || null,
          requestUsername: user?.username || null,
          requestRole: user?.role || null,
        });
        setCrmScope(resp?.scope ?? 'SELF');
        let convs: ConversationSummary[] = resp?.conversations || [];

        // Se o lead abriu o chat mas ainda não existe conversation criada,
        // criamos uma conversação "WHATSAPP" vazia para a UI mostrar dados.
        if (convs.length === 0 && leadId) {
          await authClient.createCrmConversation({ leadId, channel: "WHATSAPP" });
          const resp2 = await authClient.getCrmConversations({
            leadId: leadId || null,
            requestUsername: user?.username || null,
            requestRole: user?.role || null,
          });
          convs = resp2?.conversations || [];
        }
        if (cancelled) return;
        setConversations(convs);
        const preferredId =
          (selectedConversationId && convs.some((c) => c.id === selectedConversationId) && selectedConversationId) ||
          (crmChatCache?.selectedConversationId && convs.some((c) => c.id === crmChatCache?.selectedConversationId) ? crmChatCache.selectedConversationId : null) ||
          convs[0]?.id ||
          null;
        setSelectedConversationId(preferredId);
        if (preferredId) {
          const msgResp = await authClient.getCrmMessages(preferredId);
          if (!cancelled) applyMessagesResponse(msgResp);
        } else {
          setMessages([]);
          setRelatedLeadHistory([]);
        }
        crmChatCache = {
          leadId: leadId || null,
          conversations: convs,
          selectedConversationId: preferredId,
          messagesByConversation: crmChatCache?.messagesByConversation || {},
          messagesUpdatedAtByConversation: crmChatCache?.messagesUpdatedAtByConversation || {},
          savedAt: Date.now(),
        };
      } catch (err) {
        console.error('Erro ao carregar conversas CRM:', err);
        if (cancelled) return;
        setConversations([]);
        setSelectedConversationId(null);
      } finally {
        conversationsFetchLock.current = false;
        if (!cancelled) setConversationsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [leadId, user?.username, user?.role]);

  useEffect(() => {
    if (!selectedConversation) return;
    setClientePhone(selectedConversation.leadPhone ? String(selectedConversation.leadPhone) : '');
    setClienteEmail(selectedConversation.leadEmail ? String(selectedConversation.leadEmail) : '');
    setLeadProtocol(selectedConversation?.protocolNumber ? String(selectedConversation.protocolNumber) : '');
    setLeadRouteOrigin(selectedConversation?.routeOrigin ? String(selectedConversation.routeOrigin) : '');
    setClienteDestino(selectedConversation?.routeDestination ? String(selectedConversation.routeDestination) : '');
    setLeadRequestedAt(selectedConversation?.requestedAt ? String(selectedConversation.requestedAt).slice(0, 16) : '');
    setLeadServiceType(selectedConversation?.serviceType ? String(selectedConversation.serviceType) : 'ATENDIMENTO_GERAL');
    setLeadCargoStatus(selectedConversation?.cargoStatus ? String(selectedConversation.cargoStatus) : 'SEM_STATUS');
    setLeadCustomerStatus(selectedConversation?.customerStatus ? String(selectedConversation.customerStatus) : 'PENDENTE');
    setLeadSource(
      selectedConversation?.source && ['WHATSAPP', 'IA', 'MANUAL'].includes(String(selectedConversation.source))
        ? (String(selectedConversation.source) as any)
        : 'MANUAL'
    );
    setLeadPriority(
      selectedConversation?.priority && ['ALTA', 'MEDIA', 'BAIXA'].includes(String(selectedConversation.priority))
        ? (String(selectedConversation.priority) as any)
        : 'MEDIA'
    );
    setLeadCurrentLocation(selectedConversation?.currentLocation ? String(selectedConversation.currentLocation) : '');
    setObservacoes(selectedConversation?.observations ? String(selectedConversation.observations) : '');
    setFreteRecorrente(!!selectedConversation?.isRecurringFreight);
    setRastreioAtivo(!!selectedConversation?.trackingActive);
    setAiSummary(selectedConversation?.aiSummary ? String(selectedConversation.aiSummary) : '');
    setReplyTarget(null);
  }, [selectedConversation?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        setRelatedLeadHistory([]);
        return;
      }
      const cachedMessages = crmChatCache?.messagesByConversation?.[selectedConversationId];
      const cachedAt = crmChatCache?.messagesUpdatedAtByConversation?.[selectedConversationId] || 0;
      // Janela curta só para evitar fetch duplicado ao remontar; não pode esconder mensagens novas (ex.: Sofia via WhatsApp).
      const isFresh = !!cachedMessages && Date.now() - cachedAt < 4_000;
      if (cachedMessages) setMessages(cachedMessages);
      if (isFresh) return;
      const reqSeq = ++messagesRequestSeq.current;
      setMessagesLoading(true);
      try {
        const resp = await authClient.getCrmMessages(selectedConversationId);
        const msgs: Message[] = resp?.messages || [];
        // Ignora resposta antiga quando o usuário troca de conversa rapidamente.
        if (cancelled || reqSeq !== messagesRequestSeq.current) return;
        applyMessagesResponse(resp);
        crmChatCache = {
          leadId: leadId || null,
          conversations: crmChatCache?.conversations || [],
          selectedConversationId,
          messagesByConversation: {
            ...(crmChatCache?.messagesByConversation || {}),
            [selectedConversationId]: msgs,
          },
          messagesUpdatedAtByConversation: {
            ...(crmChatCache?.messagesUpdatedAtByConversation || {}),
            [selectedConversationId]: Date.now(),
          },
          savedAt: Date.now(),
        };
      } catch (err) {
        console.error('Erro ao carregar mensagens CRM:', err);
        if (cancelled) return;
      } finally {
        if (!cancelled && reqSeq === messagesRequestSeq.current) setMessagesLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId]);

  // Polling mais rápido para reduzir delay visual do chat.
  useEffect(() => {
    if (!selectedConversationId) return;

    const interval = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const reqSeq = ++messagesRequestSeq.current;
        const msgsResp = await authClient.getCrmMessages(selectedConversationId);
        const next = msgsResp?.messages || [];
        if (reqSeq !== messagesRequestSeq.current) return;
        applyMessagesResponse(msgsResp);
        crmChatCache = {
          leadId: leadId || null,
          conversations: crmChatCache?.conversations || [],
          selectedConversationId,
          messagesByConversation: {
            ...(crmChatCache?.messagesByConversation || {}),
            [selectedConversationId]: next,
          },
          messagesUpdatedAtByConversation: {
            ...(crmChatCache?.messagesUpdatedAtByConversation || {}),
            [selectedConversationId]: Date.now(),
          },
          savedAt: Date.now(),
        };
      } catch {
        // noop
      } finally {
        setMessagesLoading(false);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [selectedConversationId]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (document.hidden || conversationsFetchLock.current || conversationsPollInFlight.current) return;
      conversationsPollInFlight.current = true;
      try {
        const convResp = await authClient.getCrmConversations({
          leadId: leadId || null,
          requestUsername: user?.username || null,
          requestRole: user?.role || null,
        });
        const nextConvs = convResp?.conversations || [];
        setCrmScope(convResp?.scope ?? 'SELF');
        setConversations(nextConvs);
        crmChatCache = {
          leadId: leadId || null,
          conversations: nextConvs,
          selectedConversationId,
          messagesByConversation: crmChatCache?.messagesByConversation || {},
          messagesUpdatedAtByConversation: crmChatCache?.messagesUpdatedAtByConversation || {},
          savedAt: Date.now(),
        };
      } catch {
        // noop
      } finally {
        conversationsPollInFlight.current = false;
      }
    }, 20000);
    return () => window.clearInterval(interval);
  }, [leadId, selectedConversationId, user?.username, user?.role]);

  useEffect(() => {
    crmChatCache = {
      leadId: leadId || null,
      conversations,
      selectedConversationId,
      messagesByConversation: {
        ...(crmChatCache?.messagesByConversation || {}),
        ...(selectedConversationId ? { [selectedConversationId]: messages } : {}),
      },
      messagesUpdatedAtByConversation: {
        ...(crmChatCache?.messagesUpdatedAtByConversation || {}),
        ...(selectedConversationId ? { [selectedConversationId]: Date.now() } : {}),
      },
      savedAt: Date.now(),
    };
  }, [leadId, conversations, selectedConversationId, messages]);

  useEffect(() => {
    authClient
      .getCrmAgents()
      .then((resp) => setAgents(Array.isArray(resp?.agents) ? resp.agents : []))
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await authClient.getSofiaSettings();
        const s = resp?.settings;
        if (!s) return;
        if (s.name) setSofiaName(String(s.name));
        if (s.welcome) setSofiaWelcome(String(s.welcome));
        const days = s.activeDays && typeof s.activeDays === 'object' ? s.activeDays : {};
        const weekday = new Date().getDay();
        const map: Record<number, string> = {
          0: 'domingo',
          1: 'segunda',
          2: 'terca',
          3: 'quarta',
          4: 'quinta',
          5: 'sexta',
          6: 'sabado',
        };
        const key = map[weekday];
        const dayActive = !!days[key];
        setSofiaActiveToday(!!s.autoReplyEnabled && dayActive);
        setSofiaGenerateSummaryEnabled(s.generateSummaryEnabled !== false);
      } catch {
        // ignore
      }
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!selectedConversationId) return;
      if (!sofiaGenerateSummaryEnabled) return;
      if ((aiSummary || "").trim().length > 0) return;
      try {
        const resp = await authClient.getSofiaReplySuggestion({
          conversationId: selectedConversationId,
          text: messages[messages.length - 1]?.text || selectedConversation?.lastMessage || "",
          mode: "SUMMARY",
        });
        const nextSummary = String(resp?.summary || "").trim();
        if (nextSummary) {
          setAiSummary(nextSummary);
          await applyConversationUpdate({ aiSummary: nextSummary });
        }
      } catch {
        // noop
      }
    };
    run();
  }, [selectedConversationId, sofiaGenerateSummaryEnabled]);

  useEffect(() => {
    if (!selectedConversationId || !sofiaActiveToday) return;
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (!last || last.from !== "CLIENTE") return;
    const guardKey = `${selectedConversationId}:${last.id}`;
    if (autoReplyGuardRef.current === guardKey) return;
    autoReplyGuardRef.current = guardKey;
    window.setTimeout(() => {
      handleSofiaAutoReply().catch(() => {
        // noop
      });
    }, 200);
  }, [messages, selectedConversationId, sofiaActiveToday]);

  useEffect(() => {
    const run = async () => {
      if (!selectedConversation) return;
      try {
        const hint = await authClient.suggestCrmRouting({
          conversationId: selectedConversation.id,
          leadId: selectedConversation.leadId || null,
          text: selectedConversation.lastMessage,
          title: selectedConversation.leadName,
          cte: selectedConversation.cte || null,
        });
        setRoutingHint({
          topic: hint?.topic,
          targetUsername: hint?.routing?.targetUsername || hint?.routing?.fallbackAgent || null,
        });
      } catch {
        setRoutingHint(null);
      }
    };
    run();
  }, [selectedConversation?.id]);

  return (
    <div className="grid grid-cols-12 gap-4 h-full min-h-0">
      {/* Lista de conversas */}
      <aside className="col-span-12 md:col-span-3 bg-gradient-to-b from-white to-[#f7faff] border border-[#2c348c]/20 rounded-xl flex flex-col min-h-0 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
        <div className="px-3 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-1.5 text-[#e42424] border border-slate-200">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-ui-label">
                Conversas
              </h2>
              <p className="text-[11px] text-ui-muted">
                {conversations.length} atendimentos ativos
              </p>
            </div>
          </div>
          <button className="btn-ui-secondary px-2 py-1 text-[11px]">
            <Filter size={12} />
            Filtros
          </button>
        </div>
        {crmScope && (
          <div className="px-3 py-2 border-b border-slate-200 bg-[#eef3ff]/80">
            <p className="text-[10px] font-semibold text-[#1f2f86] leading-snug">
              {crmScope === 'ALL' && 'Visão global: você enxerga todas as conversas.'}
              {crmScope === 'TEAM' &&
                'Visão da equipe: conversas do seu time, sem responsável na fila e as suas.'}
              {crmScope === 'SELF' &&
                'Sua fila: conversas atribuídas a você + sem responsável (para assumir). Perfis em Configurações → CRM_SCOPE_*.'}
            </p>
          </div>
        )}
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700">
            <Hash size={12} className="text-[#2c348c]/70" />
            <input
              placeholder="Buscar por nome ou CTE..."
              className="flex-1 bg-transparent text-[11px] text-slate-800 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {conversationsLoading && (
            <div className="px-3 py-2 text-[11px] text-slate-500">Atualizando conversas...</div>
          )}
          {conversations.map((conv) => {
            const active = conv.id === selectedConversationId;
            const channel = getChannelUi(conv.channel);
            const unreadCount = effectiveUnreadByConversationId[conv.id] ?? 0;
            const hasUnread = unreadCount > 0;
            const pulseUnread = !!pulseUnreadByConversationId[conv.id];
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  setSelectedConversationId(conv.id);
                  const sig = `${conv.lastAt || ''}|${conv.lastMessage || ''}`;
                  setReadSignatures((prev) => ({ ...prev, [conv.id]: sig }));
                  const cached = crmChatCache?.messagesByConversation?.[conv.id];
                  if (cached) {
                    setMessages(cached);
                    setRelatedLeadHistory([]);
                    setMessagesLoading(false);
                  } else {
                    setMessages([]);
                    setRelatedLeadHistory([]);
                    setMessagesLoading(true);
                    authClient
                      .getCrmMessages(conv.id)
                      .then((resp) => applyMessagesResponse(resp))
                      .catch(() => {
                        setMessages([]);
                        setRelatedLeadHistory([]);
                      })
                      .finally(() => setMessagesLoading(false));
                  }
                }}
                className={clsx(
                  'flex w-full gap-2 border-b border-slate-200 px-3 py-2.5 text-left transition-all duration-150 hover:bg-slate-50 hover:pl-4',
                  active && 'bg-slate-50 border-l-2 border-l-[#2c348c]'
                )}
              >
                <div className="mt-1">
                  <LeadAvatar url={conv.leadAvatarUrl} name={conv.leadName} size={26} active={active} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={clsx('truncate text-xs text-slate-900', hasUnread ? 'font-extrabold' : 'font-semibold')}>
                      {conv.leadName}
                    </span>
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">
                      {conv.lastAt}
                    </span>
                  </div>
                  <p className={clsx('mt-0.5 truncate text-[11px]', hasUnread ? 'font-semibold text-slate-700' : 'text-slate-500')}>
                    {conv.lastMessage}
                  </p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
                        channel.className
                      )}
                    >
                      {channel.label}
                    </span>
                    {conv.inboxProvider === 'EVOLUTION' && conv.inboxName && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-900">
                        Web · {conv.inboxName}
                      </span>
                    )}
                    {!conv.inboxProvider && !conv.inboxName && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-sky-200 bg-sky-50 text-sky-900">
                        Meta · Sofia
                      </span>
                    )}
                    {hasUnread && (
                      <span
                        className={clsx(
                          'ml-auto inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-[#e42424] px-1 text-[9px] font-bold text-white',
                          pulseUnread && 'animate-pulse'
                        )}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat */}
      <section className="col-span-12 md:col-span-6 bg-gradient-to-b from-white to-[#f7faff] border border-[#2c348c]/20 rounded-xl flex flex-col min-h-0 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
              <h2 className="title-ui-section">
              {selectedConversation?.leadName || 'Selecione um atendimento'}
            </h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-ui-muted">
                <MessageCircle size={11} />
                Atendimento em andamento
              </span>
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
                  getChannelUi(selectedConversation?.channel || 'WHATSAPP').className
                )}
              >
                {getChannelUi(selectedConversation?.channel || 'WHATSAPP').label}
              </span>
              {selectedConversation?.inboxProvider === 'EVOLUTION' && selectedConversation?.inboxName && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-900">
                  Caixa Web: {selectedConversation.inboxName}
                </span>
              )}
              {selectedConversation &&
                selectedConversation.channel === 'WHATSAPP' &&
                !selectedConversation.inboxProvider &&
                !selectedConversation.inboxName && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-sky-200 bg-sky-50 text-sky-900">
                    Meta · oficial
                  </span>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedConversation?.topic && (
              <span className="px-2 py-1 rounded-full border border-slate-300 text-[10px] text-slate-800 bg-slate-100">
                Tema: {selectedConversation.topic}
              </span>
            )}
            {selectedConversation?.slaDueAt && (
              <span
                className={clsx(
                  'px-2 py-1 rounded-full border text-[10px]',
                  selectedConversation?.slaBreachedAt
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                )}
              >
                SLA: {selectedConversation?.slaBreachedAt ? 'estourado' : 'ativo'}
              </span>
            )}
            {routingHint?.targetUsername && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-900">
                IA sugere: {routingHint.targetUsername}
              </span>
            )}
          <button
            className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-[11px] text-slate-700 hover:border-[#2c348c]/40"
            onClick={() => {
              if (selectedConversation?.leadPhone) {
                window.open(`tel:${String(selectedConversation.leadPhone).replace(/\s/g, '')}`);
              }
            }}
          >
              <Phone size={14} />
              Ligar
            </button>
          </div>
        </div>

        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-white to-slate-50/70 px-3 py-3 space-y-2">
          {messagesLoading && (
            <div className="text-[11px] text-slate-500">Atualizando mensagens...</div>
          )}
          {messages.map((m) => {
            const isMe = m.from === 'AGENTE' || m.from === 'IA';
            const bubbleClass = isMe
              ? 'bg-gradient-to-br from-[#2c348c] to-[#e42424] border-transparent'
              : 'border-slate-300 bg-white';
            return (
              <div
                key={m.id}
                className={clsx(
                  'flex w-full',
                  isMe ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-[0_6px_14px_rgba(15,23,42,0.10)] border',
                    bubbleClass
                  )}
                >
                  <div
                    className={clsx(
                      'mb-0.5 text-[11px] font-semibold',
                      isMe ? 'text-white/90' : 'text-slate-600'
                    )}
                  >
                    {m.from === 'CLIENTE'
                      ? 'Cliente'
                      : m.from === 'IA'
                      ? 'IA'
                      : m.fromLabel || 'Atendente'}
                  </div>
                  <MediaPlaceholderHint text={m.text} isMe={isMe} />
                  {m.replyTo?.text && (
                    <div
                      className={clsx(
                        'mb-1 rounded-lg border px-2 py-1 text-[10px] truncate',
                        isMe
                          ? 'border-white/25 bg-white/10 text-white/90'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      )}
                    >
                      {m.replyTo?.sender || 'Mensagem'}: {m.replyTo.text}
                    </div>
                  )}
                  {!isSingleLinePlaceholder(m.text) && (
                    <div
                      className={clsx(
                        'whitespace-pre-wrap text-[12px] leading-relaxed',
                        isMe ? 'text-white' : 'text-slate-800'
                      )}
                    >
                      {m.text}
                    </div>
                  )}
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className={clsx('mt-1 text-[10px]', isMe ? 'text-white/70' : 'text-slate-500')}>
                      {m.attachments.map((a, idx) => (
                        <div key={idx}>Anexo: {a.filename || a.type || 'arquivo'}</div>
                      ))}
                    </div>
                  )}
                  <div
                    className={clsx(
                      'mt-1 flex items-center justify-between text-[10px]',
                      isMe ? 'text-white/70' : 'text-slate-500'
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {m.createdAt
                        ? new Intl.DateTimeFormat('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Sao_Paulo',
                          }).format(new Date(m.createdAt))
                        : m.time}
                      {m.edited && (
                        <span
                          className={clsx(
                            'text-[9px] italic',
                            isMe ? 'text-white/80' : 'text-slate-400'
                          )}
                        >
                          editada
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {!m.deleted && (
                        <button
                          type="button"
                          className={clsx(
                            'text-[9px] underline underline-offset-2',
                            isMe ? 'text-white/80' : 'text-slate-500'
                          )}
                          onClick={() =>
                            setReplyTarget({
                              messageId: m.id,
                              sender: m.from === 'CLIENTE' ? 'Cliente' : m.from === 'IA' ? 'IA' : (m.fromLabel || 'Atendente'),
                              text: m.text,
                            })
                          }
                        >
                          responder
                        </button>
                      )}
                      {!m.deleted && isMe && (
                        <button
                          type="button"
                          className={clsx(
                            'text-[9px] underline underline-offset-2',
                            isMe ? 'text-white/80' : 'text-slate-500'
                          )}
                          onClick={() => {
                            if (!selectedConversationId) return;
                            setPendingDeleteMessageId(m.id);
                          }}
                        >
                          excluir
                        </button>
                      )}
                      <span className="text-[9px]">
                        {m.status === 'read'
                          ? 'Lida'
                          : m.status === 'delivered'
                          ? 'Entregue'
                          : m.status === 'sent'
                          ? 'Enviada'
                          : m.status === 'received'
                          ? 'Recebida'
                          : m.status === 'failed'
                          ? 'Falhou'
                          : m.status === 'pending'
                          ? 'Enviando'
                          : ''}
                      </span>
                      <span
                        className={clsx(
                          'px-1 py-0.5 rounded-full border text-[9px]',
                          getChannelUi(m.channel).className
                        )}
                      >
                        {getChannelUi(m.channel).label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex flex-col gap-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={selectedConversation?.assignedUsername || ''}
              onChange={async (e) => {
                const username = e.target.value || null;
                await applyConversationUpdate({
                  assignedUsername: username,
                  assignmentMode: 'MANUAL',
                });
              }}
              className="rounded-lg bg-white border border-slate-300 px-2 py-2 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
            >
              <option value="">Sem responsável</option>
              {agents.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.username} ({a.activeConversations || 0})
                </option>
              ))}
            </select>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <button
                type="button"
                onClick={() =>
                  applyConversationUpdate({
                    lockAction: selectedConversation?.lockedBy ? 'UNLOCK' : 'CLAIM',
                    lockBy: user?.username || null,
                    lockMinutes: 20,
                  })
                }
                className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-[11px] text-slate-800 hover:border-[#2c348c]/40"
              >
                {selectedConversation?.lockedBy ? `Desbloquear (${selectedConversation.lockedBy})` : 'Assumir conversa'}
              </button>
              <button
                type="button"
                onClick={() =>
                  applyConversationUpdate({
                    assignedUsername: null,
                    assignmentMode: 'MANUAL',
                  })
                }
                disabled={!selectedConversation?.assignedUsername}
                className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Devolver à fila
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
              <span>Conectado • Fluxo de chat CRM</span>
            </div>
            <span
              className={clsx(
                'px-2 py-0.5 rounded-full border text-[9px] font-semibold',
                sofiaActiveToday
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-slate-100 text-slate-600'
              )}
            >
              {sofiaActiveToday ? `${sofiaName} ativa hoje` : `${sofiaName} apenas suporte`}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="p-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-[#2c348c] hover:border-[#2c348c]/40"
              onClick={() => {
                setEmojiOpen((v) => !v);
              }}
            >
              <Smile size={18} />
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-700 hover:border-[#2c348c]/40"
              onClick={handleSofiaSuggest}
              disabled={sofiaSuggesting}
            >
              {sofiaSuggesting ? 'Sofia...' : 'Sofia'}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-[#2c348c] border border-slate-300 text-[10px] text-white hover:bg-[#e42424]"
              onClick={handleSofiaAutoReply}
              disabled={sofiaAutoRunning}
            >
              {sofiaAutoRunning ? 'Auto...' : 'Sofia Auto'}
            </button>
            <button
              type="button"
              className="p-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-[#2c348c] hover:border-[#2c348c]/40"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setAttachmentFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            <div className="flex-1">
              {replyTarget && (
                <div className="mb-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] text-slate-700 flex items-center justify-between gap-2">
                  <span className="truncate">Respondendo {replyTarget.sender}: {replyTarget.text}</span>
                  <button type="button" className="text-[10px] text-slate-500 hover:text-[#e42424]" onClick={() => setReplyTarget(null)}>
                    limpar
                  </button>
                </div>
              )}
              <textarea
                ref={messageInputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!sendingAttachment) handleSend();
                  }
                }}
                placeholder="Digite sua mensagem..."
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                style={{ minHeight: 38, maxHeight: 168 }}
              />
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendingAttachment}
              className="rounded-full bg-[#2c348c] p-2.5 text-white shadow-md transition-colors hover:bg-[#e42424] disabled:opacity-60"
            >
              <Send size={18} />
            </button>
          </div>
          {emojiOpen && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 grid grid-cols-8 gap-1">
              {['😀','😁','😂','😊','😉','😍','🤝','🙏','👍','✅','📦','🚚','📍','⏰','⚠️','📞'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setInput((prev) => `${prev}${prev ? ' ' : ''}${emoji}`);
                    setEmojiOpen(false);
                  }}
                  className="h-8 rounded-lg hover:bg-slate-100 text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {attachmentFiles.length > 0 && (
            <div className="text-[10px] text-slate-500">
              {attachmentFiles.length} arquivo(s) pronto(s) para envio
            </div>
          )}
        </div>
      </section>

      {/* Dados do cliente */}
      <aside className="col-span-12 md:col-span-3 bg-gradient-to-b from-white to-[#f7faff] border border-[#2c348c]/20 rounded-xl p-4 flex flex-col space-y-3 min-h-0 overflow-y-auto shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="title-ui-section">Dados do Cliente</h2>
            <p className="text-[11px] text-ui-muted">Resumo rápido do lead</p>
          </div>
        </div>
        <div className="flex gap-2 text-[10px]">
          {(['PENDENTE', 'CONCLUIDO', 'EM_RASTREIO', 'PERDIDO'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={async () => {
                setStatusAtendimento(st);
                await applyConversationUpdate({ status: st });
              }}
              className={clsx(
                'px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wide',
                statusAtendimento === st
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#2c348c]/40'
              )}
            >
              {st === 'PENDENTE' && 'Pendente'}
              {st === 'CONCLUIDO' && 'Concluído'}
              {st === 'EM_RASTREIO' && 'Em Rastreio'}
              {st === 'PERDIDO' && 'Perdido'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-[11px] border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setInfoTab('detalhes')}
            className={clsx(
              'px-2 py-1 rounded-md',
              infoTab === 'detalhes'
                ? 'bg-[#2c348c] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            Detalhes
          </button>
          <button
            type="button"
            onClick={() => setInfoTab('midia')}
            className={clsx(
              'px-2 py-1 rounded-md',
              infoTab === 'midia'
                ? 'bg-[#2c348c] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            Mídia
          </button>
          <button
            type="button"
            onClick={() => setInfoTab('resumo')}
            className={clsx(
              'px-2 py-1 rounded-md',
              infoTab === 'resumo'
                ? 'bg-[#2c348c] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            Resumo
          </button>
        </div>

        {infoTab === 'detalhes' && (
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <LeadAvatar
                  url={selectedConversation?.leadAvatarUrl}
                  name={selectedConversation?.leadName || 'contato'}
                  size={28}
                  active
                />
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {selectedConversation?.leadName || '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Código interno #{(selectedConversation?.id || '').padStart(4, '0')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                  {freteRecorrente ? 'Frete recorrente' : 'Frete pontual'}
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] text-sky-800">
                  {rastreioAtivo ? 'Rastreio ativo' : 'Rastreio inativo'}
                </span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Informações de contato
              </p>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Telefone</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                  value={clientePhone}
                  onChange={(e) => setClientePhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">E-mail</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Observações</label>
                <textarea
                  className="min-h-[70px] w-full resize-none rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-700">
                  <input type="checkbox" checked={freteRecorrente} onChange={(e) => setFreteRecorrente(e.target.checked)} />
                  Frete recorrente
                </label>
                <label className="flex items-center gap-2 text-[11px] text-slate-700">
                  <input type="checkbox" checked={rastreioAtivo} onChange={(e) => setRastreioAtivo(e.target.checked)} />
                  Rastreio ativo
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Unidade de destino</label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                  value={clienteDestino}
                  onChange={(e) => setClienteDestino(e.target.value)}
                >
                  <option value="">Selecione a unidade</option>
                  {destinationUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Protocolo</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadProtocol}
                    onChange={(e) => setLeadProtocol(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Origem da rota</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadRouteOrigin}
                    onChange={(e) => setLeadRouteOrigin(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Origem</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value as any)}
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IA">IA</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Prioridade</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadPriority}
                    onChange={(e) => setLeadPriority(e.target.value as any)}
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Tipo de atendimento</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadServiceType}
                    onChange={(e) => setLeadServiceType(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Solicitação</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadRequestedAt}
                    onChange={(e) => setLeadRequestedAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Status da carga</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadCargoStatus}
                    onChange={(e) => setLeadCargoStatus(e.target.value)}
                  >
                    <option value="SEM_STATUS">Sem status</option>
                    <option value="EM_COLETA">Em coleta</option>
                    <option value="EM_TRANSFERENCIA">Em transferencia</option>
                    <option value="EM_ENTREGA">Em entrega</option>
                    <option value="ENTREGUE">Entregue</option>
                    <option value="OCORRENCIA">Ocorrencia</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Status do cliente</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                    value={leadCustomerStatus}
                    onChange={(e) => setLeadCustomerStatus(e.target.value)}
                  >
                    <option value="PENDENTE">Pendente</option>
                    <option value="EM_ATENDIMENTO">Em atendimento</option>
                    <option value="AGUARDANDO_RETORNO_AGENCIA">Aguardando agencia</option>
                    <option value="HUMANO_SOLICITADO">Humano solicitado</option>
                    <option value="CONCLUIDO">Concluido</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Localização / rastreio</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                  value={leadCurrentLocation}
                  onChange={(e) => setLeadCurrentLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Canal preferido</label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                  value={clientePreferencia}
                  onChange={(e) => setClientePreferencia(e.target.value as any)}
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="LIGACAO">Ligação</option>
                  <option value="EMAIL">E-mail</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleSaveClientData}
                disabled={savingClientData || !selectedConversation?.leadId}
                className="w-full mt-1 rounded-lg bg-[#2c348c] border border-slate-300 px-2 py-1.5 text-[11px] text-white hover:bg-[#e42424] disabled:opacity-60"
              >
                {savingClientData ? 'Salvando dados...' : 'Salvar dados do cliente'}
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">
                Último rastreio
              </p>
              <p className="text-xs text-slate-700">
                {ultimoRastreio || 'Nenhum CTE consultado ainda nesta conversa.'}
              </p>
              {!!selectedConversation?.cte && onOpenTracking && (
                <button
                  type="button"
                  onClick={() => onOpenTracking(selectedConversation.cte || '')}
                  className="mt-2 px-2 py-1 text-[11px] rounded bg-[#2c348c] text-white hover:bg-[#e42424]"
                >
                  Abrir detalhe do rastreio
                </button>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">
                Contexto do lead (outras conversas)
              </p>
              {relatedLeadHistory.length === 0 ? (
                <p className="text-[11px] text-slate-600">
                  Sem histórico recente em outras conversas deste lead.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {relatedLeadHistory.slice(0, 8).map((h) => (
                    <div key={h.messageId} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-slate-700">
                          {h.senderType} · {h.channel}
                          {h.inboxName ? ` · ${h.inboxName}` : ""}
                        </span>
                        <span className="text-[10px] text-slate-500">{h.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 line-clamp-2">{h.body || "[Sem texto]"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {infoTab === 'midia' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">
              Mídia da conversa
            </p>
            <p className="text-[11px] text-slate-600">
              (Demo) Aqui você verá imagens, PDFs, áudios e outros anexos trocados nesta
              conversa.
            </p>
          </div>
        )}

        {infoTab === 'resumo' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">
              Resumo da conversa para IA
            </p>
            <p className="text-xs text-slate-700">
              {sofiaName} pode usar este resumo como contexto para responder de forma mais
              humana e alinhada às regras da São Luiz Express.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">
                Estatísticas rápidas
              </p>
              <p className="text-[11px] text-slate-700">
                Mensagens totais: {messages.length}
              </p>
              <p className="text-[11px] text-slate-700">
                Respostas IA: {messages.filter((m) => m.from === 'IA').length}
              </p>
              <p className="text-[11px] text-slate-700">
                Última interação: {messages[messages.length - 1]?.time || '--'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Resumo incremental
              </p>
              <textarea
                className="min-h-[100px] w-full resize-none rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-[#2c348c]/45 focus:ring-2 focus:ring-[#2c348c]/25"
                value={aiSummary}
                onChange={(e) => setAiSummary(e.target.value)}
                placeholder="Contexto geral, pendências e próximo passo (estilo resumo de e-mail)."
              />
              <button
                type="button"
                onClick={() => applyConversationUpdate({ aiSummary })}
                className="rounded-lg bg-[#2c348c] border border-slate-300 px-2 py-1.5 text-[11px] text-white hover:bg-[#e42424]"
              >
                Salvar resumo IA
              </button>
            </div>
          </div>
        )}
      </aside>

      <AppMessageModal
        open={!!appNotice}
        title={appNotice?.title || ''}
        message={appNotice?.message || ''}
        variant={appNotice?.variant || 'info'}
        onClose={() => setAppNotice(null)}
      />

      <AppConfirmModal
        open={!!pendingDeleteMessageId}
        title="Excluir mensagem"
        message="Remover esta mensagem do CRM? Essa ação não pode ser desfeita pelo painel."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
        busy={deletingMessage}
        onCancel={() => !deletingMessage && setPendingDeleteMessageId(null)}
        onConfirm={async () => {
          if (!selectedConversationId || !pendingDeleteMessageId) return;
          setDeletingMessage(true);
          try {
            await authClient.deleteCrmMessage({
              conversationId: selectedConversationId,
              messageId: pendingDeleteMessageId,
            });
            const msgsResp = await authClient.getCrmMessages(selectedConversationId);
            applyMessagesResponse(msgsResp);
            setPendingDeleteMessageId(null);
          } catch (err) {
            console.error(err);
            setAppNotice({
              title: 'Erro',
              message: 'Não foi possível excluir a mensagem.',
              variant: 'error',
            });
            setPendingDeleteMessageId(null);
          } finally {
            setDeletingMessage(false);
          }
        }}
      />
    </div>
  );
};

export default CrmChat;

