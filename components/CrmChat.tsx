import React, { useMemo, useState, useEffect } from 'react';
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
}

interface Message {
  id: string;
  from: 'CLIENTE' | 'AGENTE' | 'IA';
  text: string;
  time: string;
  channel: Channel;
}

const channelConfig: Record<Channel, { label: string; className: string }> = {
  WHATSAPP: {
    label: 'WhatsApp',
    className: 'bg-emerald-900/40 text-emerald-200 border-emerald-500/70',
  },
  IA: {
    label: 'IA',
    className: 'bg-sky-900/40 text-sky-200 border-sky-500/70',
  },
  INTERNO: {
    label: 'Interno',
    className: 'bg-slate-800 text-slate-200 border-slate-500/60',
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
}

const CrmChat: React.FC<Props> = ({ leadId }) => {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [ultimoRastreio, setUltimoRastreio] = useState<string | null>(null);
  const [sofiaName, setSofiaName] = useState('Sofia');
  const [sofiaWelcome, setSofiaWelcome] = useState(
    'Olá! Sou a Sofia, assistente virtual da São Luiz Express. Como posso te ajudar hoje?'
  );
  const [sofiaActiveToday, setSofiaActiveToday] = useState<boolean>(true);

  const { pendencias, criticos } = useData();

  const selectedConversation = useMemo(() => {
    if (!conversations.length) return null;
    if (selectedConversationId) {
      return conversations.find((c) => c.id === selectedConversationId) || conversations[0];
    }
    return conversations[0];
  }, [conversations, selectedConversationId]);

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
    if (!input.trim()) return;
    const text = input.trim();

    const matches = text.match(/\b\d{5,}\b/g);
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
      const resp = await authClient.sendCrmMessage({
        conversationId: selectedConversationId,
        leadId: leadForSend,
        channel,
        senderType: 'AGENTE',
        body: text,
        senderUsername: user?.username ?? null,
      });

      const nextConversationId = resp?.conversationId || selectedConversationId;
      if (nextConversationId) {
        const msgsResp = await authClient.getCrmMessages(nextConversationId);
        setMessages(msgsResp.messages || []);
      }

      const convResp = await authClient.getCrmConversations({ leadId: leadId || null });
      setConversations(convResp.conversations || []);
      if (nextConversationId) setSelectedConversationId(nextConversationId);
    } catch (err) {
      console.error('Erro ao enviar mensagem CRM:', err);
      // Mantém input se falhar para o usuário reenviar.
      setInput(text);
    }
  };

  useEffect(() => {
    // Detecta CTE no histórico atual (após carregar mensagens).
    if (!messages.length) {
      setUltimoRastreio(null);
      return;
    }

    const allText = messages.map((m) => m.text).join(' ');
    const matches = allText.match(/\b\d{5,}\b/g);
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
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const resp = await authClient.getCrmConversations({ leadId: leadId || null });
        let convs: ConversationSummary[] = resp?.conversations || [];

        // Se o lead abriu o chat mas ainda não existe conversation criada,
        // criamos uma conversação "WHATSAPP" vazia para a UI mostrar dados.
        if (convs.length === 0 && leadId) {
          await authClient.createCrmConversation({ leadId, channel: "WHATSAPP" });
          const resp2 = await authClient.getCrmConversations({ leadId: leadId || null });
          convs = resp2?.conversations || [];
        }
        if (cancelled) return;
        setConversations(convs);
        setSelectedConversationId(convs[0]?.id || null);
      } catch (err) {
        console.error('Erro ao carregar conversas CRM:', err);
        if (cancelled) return;
        setConversations([]);
        setSelectedConversationId(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

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
      try {
        const resp = await authClient.getCrmMessages(selectedConversationId);
        const msgs: Message[] = resp?.messages || [];
        if (cancelled) return;
        setMessages(msgs);
      } catch (err) {
        console.error('Erro ao carregar mensagens CRM:', err);
        if (cancelled) return;
        setMessages([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId]);

  // Polling barato para refletir mensagens recebidas via webhook.
  useEffect(() => {
    if (!leadId) return;
    if (!selectedConversationId) return;

    const interval = window.setInterval(async () => {
      try {
        const convResp = await authClient.getCrmConversations({ leadId: leadId || null });
        setConversations(convResp?.conversations || []);

        const msgsResp = await authClient.getCrmMessages(selectedConversationId);
        setMessages(msgsResp?.messages || []);
      } catch (err) {
        // não quebra a UI por falha de polling
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [leadId, selectedConversationId]);

  useEffect(() => {
    // Carrega configurações da Sofia salvas localmente
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem('sofiaSettings');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.name) setSofiaName(parsed.name);
      if (parsed.welcome) setSofiaWelcome(parsed.welcome);
      const days = parsed.days || {};
      const weekday = new Date().getDay(); // 0-dom,1-seg,...6-sab
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
      setSofiaActiveToday(!!days[key]);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
      {/* Lista de conversas */}
      <aside className="col-span-12 md:col-span-3 bg-[#070A20] border border-[#1E226F] rounded-xl flex flex-col">
        <div className="px-3 py-3 border-b border-[#1A1B62] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#0F103A] p-1.5 text-[#EC1B23] border border-[#1A1B62]">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                Conversas
              </h2>
              <p className="text-[10px] text-gray-500">
                {conversations.length} atendimentos ativos
              </p>
            </div>
          </div>
          <button className="inline-flex items-center gap-1 text-[11px] text-gray-300 px-2 py-1 rounded-lg border border-[#1A1B62] hover:border-[#6E71DA] hover:text-white">
            <Filter size={12} />
            Filtros
          </button>
        </div>
        <div className="px-3 py-2 border-b border-[#1A1B62]">
          <div className="flex items-center gap-2 bg-[#080816] border border-[#1A1B62] rounded-lg px-2 py-1.5 text-[11px] text-gray-300">
            <Hash size={12} className="text-[#6E71DA]" />
            <input
              placeholder="Buscar por nome ou CTE..."
              className="bg-transparent outline-none flex-1 text-[11px] placeholder-gray-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const active = conv.id === selectedConversationId;
            const channel = channelConfig[conv.channel];
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedConversationId(conv.id)}
                className={clsx(
                  'w-full px-3 py-2.5 text-left flex gap-2 border-b border-[#080816] hover:bg-[#080816] transition-colors',
                  active && 'bg-[#080816]'
                )}
              >
                <div className="mt-1">
                  <UserCircle2
                    size={26}
                    className={active ? 'text-[#EC1B23]' : 'text-[#6E71DA]'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-white truncate">
                      {conv.leadName}
                    </span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {conv.lastAt}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
                        channel.className
                      )}
                    >
                      {channel.label}
                    </span>
                    {conv.unread > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#EC1B23] text-[9px] font-bold text-white">
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
      <section className="col-span-12 md:col-span-6 bg-[#070A20] border border-[#1E226F] rounded-xl flex flex-col">
        <div className="px-4 py-3 border-b border-[#1A1B62] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              {selectedConversation?.leadName || 'Selecione um atendimento'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
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
            </div>
          </div>
          <button className="inline-flex items-center gap-1 rounded-full bg-[#080816] border border-[#1A1B62] px-3 py-1 text-[11px] text-gray-200 hover:border-[#6E71DA]">
            <Phone size={14} />
            Ligar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {messages.map((m) => {
            const isMe = m.from === 'AGENTE' || m.from === 'IA';
            const bubbleClass = isMe
              ? 'bg-gradient-to-br from-[#1A1B62] to-[#EC1B23]'
              : 'bg-[#111827]';
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
                    'max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-md',
                    bubbleClass
                  )}
                >
                  <div className="text-[11px] font-semibold mb-0.5 text-white/80">
                    {m.from === 'CLIENTE'
                      ? 'Cliente'
                      : m.from === 'IA'
                      ? 'IA'
                      : 'Atendente'}
                  </div>
                  <div className="text-[12px] text-white leading-relaxed whitespace-pre-wrap">
                    {m.text}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-white/70">
                    <span>{m.time}</span>
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
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-[#1A1B62] flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
              <span>Conectado • Fluxo de chat CRM</span>
            </div>
            <span
              className={clsx(
                'px-2 py-0.5 rounded-full border text-[9px] font-semibold',
                sofiaActiveToday
                  ? 'border-emerald-500 text-emerald-300'
                  : 'border-gray-600 text-gray-300'
              )}
            >
              {sofiaActiveToday ? `${sofiaName} ativa hoje` : `${sofiaName} apenas suporte`}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="p-2 rounded-full bg-[#080816] border border-[#1A1B62] text-gray-300 hover:text-white hover:border-[#6E71DA]"
            >
              <Smile size={18} />
            </button>
            <button
              type="button"
              className="p-2 rounded-full bg-[#080816] border border-[#1A1B62] text-gray-300 hover:text-white hover:border-[#6E71DA]"
            >
              <Paperclip size={18} />
            </button>
            <div className="flex-1">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="w-full bg-[#080816] border border-[#1A1B62] rounded-2xl px-4 py-2 text-xs text-gray-100 placeholder-gray-500 outline-none resize-none focus:ring-1 focus:ring-[#EC1B23]"
              />
            </div>
            <button
              type="button"
              onClick={handleSend}
              className="p-2.5 rounded-full bg-[#1A1B62] text-white hover:bg-[#EC1B23] shadow-[0_0_18px_rgba(26,27,98,0.8)]"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Dados do cliente */}
      <aside className="col-span-12 md:col-span-3 bg-[#070A20] border border-[#1E226F] rounded-xl p-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-sm font-bold text-white">Dados do Cliente</h2>
            <p className="text-[11px] text-gray-400">Resumo rápido do lead</p>
          </div>
        </div>
        <div className="flex gap-2 text-[10px]">
          {(['PENDENTE', 'CONCLUIDO', 'EM_RASTREIO', 'PERDIDO'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusAtendimento(st)}
              className={clsx(
                'px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wide',
                statusAtendimento === st
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-[#080816] text-gray-300 border-[#1A1B62] hover:border-[#6E71DA]'
              )}
            >
              {st === 'PENDENTE' && 'Pendente'}
              {st === 'CONCLUIDO' && 'Concluído'}
              {st === 'EM_RASTREIO' && 'Em Rastreio'}
              {st === 'PERDIDO' && 'Perdido'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-[11px] border-b border-[#1A1B62] pb-2">
          <button
            type="button"
            onClick={() => setInfoTab('detalhes')}
            className={clsx(
              'px-2 py-1 rounded-md',
              infoTab === 'detalhes'
                ? 'bg-[#1A1B62] text-white'
                : 'text-gray-300 hover:bg-[#080816]'
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
                ? 'bg-[#1A1B62] text-white'
                : 'text-gray-300 hover:bg-[#080816]'
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
                ? 'bg-[#1A1B62] text-white'
                : 'text-gray-300 hover:bg-[#080816]'
            )}
          >
            Resumo
          </button>
        </div>

        {infoTab === 'detalhes' && (
          <div className="space-y-3">
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <UserCircle2 size={28} className="text-[#EC1B23]" />
                <div>
                  <p className="text-xs font-semibold text-white">
                    {selectedConversation?.leadName || '—'}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Código interno #{(selectedConversation?.id || '').padStart(4, '0')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-200 text-[10px] border border-emerald-500/60">
                  Frete recorrente
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-900/40 text-sky-200 text-[10px] border border-sky-500/60">
                  Rastreio ativo
                </span>
              </div>
            </div>
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                Informações de contato
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Telefone</label>
                <input
                  className="w-full rounded-lg bg-[#080816] border border-[#1E226F] px-2 py-1 text-[11px] text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                  value={clientePhone}
                  onChange={(e) => setClientePhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">E-mail</label>
                <input
                  className="w-full rounded-lg bg-[#080816] border border-[#1E226F] px-2 py-1 text-[11px] text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Observações</label>
                <textarea
                  className="w-full rounded-lg bg-[#080816] border border-[#1E226F] px-2 py-1 text-[11px] text-gray-100 outline-none min-h-[70px] resize-none focus:ring-1 focus:ring-[#EC1B23]"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                Último rastreio
              </p>
              <p className="text-xs text-gray-200">
                {ultimoRastreio || 'Nenhum CTE consultado ainda nesta conversa.'}
              </p>
            </div>
          </div>
        )}

        {infoTab === 'midia' && (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Mídia da conversa
            </p>
            <p className="text-[11px] text-gray-500">
              (Demo) Aqui você verá imagens, PDFs, áudios e outros anexos trocados nesta
              conversa.
            </p>
          </div>
        )}

        {infoTab === 'resumo' && (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Resumo da conversa para IA
            </p>
            <p className="text-xs text-gray-200">
              {sofiaName} pode usar este resumo como contexto para responder de forma mais
              humana e alinhada às regras da São Luiz Express.
            </p>
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                Estatísticas rápidas
              </p>
              <p className="text-[11px] text-gray-200">
                Mensagens totais: {messages.length}
              </p>
              <p className="text-[11px] text-gray-200">
                Respostas IA: {messages.filter((m) => m.from === 'IA').length}
              </p>
              <p className="text-[11px] text-gray-200">
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

