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
} from 'lucide-react';
import clsx from 'clsx';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../lib/auth';

type Channel = 'WHATSAPP' | 'IA' | 'INTERNO';

interface ConversationSummary {
  id: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
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
  /** Caixa WhatsApp (null = linha oficial Meta / Sofia) */
  inboxName?: string | null;
  inboxProvider?: string | null;
}

interface Message {
  id: string;
  from: 'CLIENTE' | 'AGENTE' | 'IA';
  text: string;
  time: string;
  channel: Channel;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  attachments?: Array<{ type?: string; filename?: string | null }>;
  optimistic?: boolean;
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

const CrmChat: React.FC<Props> = ({ leadId, onOpenTracking }) => {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [clientePhone, setClientePhone] = useState('(11) 99999-0000');
  const [clienteEmail, setClienteEmail] = useState('contato@cliente.com.br');
  const [observacoes, setObservacoes] = useState(
    'Cliente estratégico com alto volume mensal de envios.'
  );
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
  const [savingClientData, setSavingClientData] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const conversationsFetchLock = useRef(false);
  const conversationsPollInFlight = useRef(false);
  const messagesRequestSeq = useRef(0);

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
        setMessages(next);
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
        routeDestination: clienteDestino || null,
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
      });

      const nextConversationId = resp?.conversationId || selectedConversationId;
      if (nextConversationId) {
        const msgsResp = await authClient.getCrmMessages(nextConversationId);
        setMessages(msgsResp.messages || []);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === nextConversationId ? { ...c, lastMessage: text, lastAt: 'agora' } : c
        )
      );
      if (nextConversationId) setSelectedConversationId(nextConversationId);
      setAttachmentFiles([]);
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
        alert('Sofia não gerou resposta para este contexto.');
        return;
      }

      const allowAuto = !!resp?.governance?.allowAutoSend;
      if (!allowAuto) {
        const reason = String(resp?.governance?.reason || 'governance_blocked');
        setInput(suggestionText);
        alert(`Governança bloqueou autoenvio (${reason}). A resposta foi colocada no campo para revisão humana.`);
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
      setMessages(msgsResp.messages || []);
      setInput('');
      alert('Sofia respondeu automaticamente com governança aplicada.');
    } catch (e) {
      console.error("Erro ao executar auto resposta da Sofia:", e);
      alert('Falha ao executar auto resposta da Sofia.');
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
          if (!cancelled) setMessages(msgResp?.messages || []);
        } else {
          setMessages([]);
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
    // Observações ainda são locais (fase 2: persistir).
  }, [selectedConversation?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedConversationId) {
        setMessages([]);
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
        setMessages(msgs);
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
        setMessages(next);
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
      } catch {
        // ignore
      }
    };
    run();
  }, []);

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
            const channel = channelConfig[conv.channel];
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  setSelectedConversationId(conv.id);
                  const cached = crmChatCache?.messagesByConversation?.[conv.id];
                  if (cached) {
                    setMessages(cached);
                    setMessagesLoading(false);
                  } else {
                    setMessages([]);
                    setMessagesLoading(true);
                    authClient
                      .getCrmMessages(conv.id)
                      .then((resp) => setMessages(resp?.messages || []))
                      .catch(() => setMessages([]))
                      .finally(() => setMessagesLoading(false));
                  }
                }}
                className={clsx(
                  'flex w-full gap-2 border-b border-slate-200 px-3 py-2.5 text-left transition-all duration-150 hover:bg-slate-50 hover:pl-4',
                  active && 'bg-slate-50 border-l-2 border-l-[#2c348c]'
                )}
              >
                <div className="mt-1">
                  <UserCircle2
                    size={26}
                    className={active ? 'text-[#e42424]' : 'text-[#2c348c]/70'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-semibold text-slate-900">
                      {conv.leadName}
                    </span>
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">
                      {conv.lastAt}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
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
                    {conv.unread > 0 && (
                      <span className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#e42424] text-[9px] font-bold text-white">
                        {conv.unread}
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
                  channelConfig[(selectedConversation?.channel || 'WHATSAPP') as Channel].className
                )}
              >
                {channelConfig[(selectedConversation?.channel || 'WHATSAPP') as Channel].label}
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

        <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-white to-slate-50/70 px-3 py-3 space-y-2">
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
                      : 'Atendente'}
                  </div>
                  <div
                    className={clsx(
                      'whitespace-pre-wrap text-[12px] leading-relaxed',
                      isMe ? 'text-white' : 'text-slate-800'
                    )}
                  >
                    {m.text}
                  </div>
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
                    <span>{m.time}</span>
                    <div className="flex items-center gap-1">
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
                          channelConfig[m.channel].className
                        )}
                      >
                        {channelConfig[m.channel].label}
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
              <textarea
                ref={messageInputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                <UserCircle2 size={28} className="text-[#e42424]" />
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
                  Frete recorrente
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] text-sky-800">
                  Rastreio ativo
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
          </div>
        )}
      </aside>
    </div>
  );
};

export default CrmChat;

