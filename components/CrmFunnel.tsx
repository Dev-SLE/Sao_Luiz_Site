import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, MapPin, Phone, Plus, Columns3, ArrowRightCircle } from 'lucide-react';
import clsx from 'clsx';
import { authClient } from '../lib/auth';
import { useAuth } from '../context/AuthContext';

type Priority = 'ALTA' | 'MEDIA' | 'BAIXA';
type Source = 'WHATSAPP' | 'IA' | 'MANUAL';

interface LeadCard {
  id: string;
  title: string;
  phone?: string;
  cte?: string;
  freteValue?: number;
  source: Source;
  priority: Priority;
  currentLocation?: string;
  stageId: string;
  logs?: string[];
}

interface Stage {
  id: string;
  name: string;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  ALTA: {
    label: 'Alta',
    className: 'bg-red-900/60 text-red-200 border-red-500/70',
  },
  MEDIA: {
    label: 'Média',
    className: 'bg-amber-900/60 text-amber-200 border-amber-500/70',
  },
  BAIXA: {
    label: 'Baixa',
    className: 'bg-emerald-900/50 text-emerald-200 border-emerald-500/60',
  },
};

const sourceConfig: Record<Source, { label: string; className: string }> = {
  WHATSAPP: {
    label: 'WhatsApp',
    className: 'bg-emerald-900/40 text-emerald-200 border-emerald-500/60',
  },
  IA: {
    label: 'IA',
    className: 'bg-sky-900/40 text-sky-200 border-sky-500/60',
  },
  MANUAL: {
    label: 'Manual',
    className: 'bg-slate-800 text-slate-200 border-slate-500/60',
  },
};

interface Props {
  onGoToChat?: (leadId: string) => void;
}

const CrmFunnel: React.FC<Props> = ({ onGoToChat }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const saveLeadLock = useRef(false);
  const savePipelineLock = useRef(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<LeadCard[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);

  const [leadForm, setLeadForm] = useState({
    title: '',
    phone: '',
    cte: '',
    freteValue: '',
    source: 'WHATSAPP' as Source,
    priority: 'MEDIA' as Priority,
  });

  const [pipelineForm, setPipelineForm] = useState({
    name: 'Funil Padrão',
    columns: 'Novos, Qualificando, Negociando, Fechado',
  });

  const refreshBoard = async () => {
    setLoading(true);
    try {
      const board = await authClient.getCrmBoard();
      setStages((board.stages || []).map((s: any) => ({ id: String(s.id), name: String(s.name) })));
      setLeads((board.leads || []).map((l: any) => ({
        id: String(l.id),
        title: String(l.title),
        phone: l.phone ? String(l.phone) : undefined,
        cte: l.cte ? String(l.cte) : undefined,
        freteValue: typeof l.freteValue === 'number' ? l.freteValue : undefined,
        source: (String(l.source || 'MANUAL') as Source) || 'MANUAL',
        priority: (String(l.priority || 'MEDIA') as Priority) || 'MEDIA',
        currentLocation: l.currentLocation ? String(l.currentLocation) : undefined,
        stageId: String(l.stageId),
        logs: Array.isArray(l.logs) ? l.logs.map((x: any) => String(x)) : [],
      })));
    } catch (err) {
      console.error('Erro ao carregar CRM board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadCard[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    leads.forEach((lead) => {
      if (!map[lead.stageId]) map[lead.stageId] = [];
      map[lead.stageId].push(lead);
    });
    return map;
  }, [leads, stages]);

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDropOnStage = (stageId: string) => {
    if (!draggingId) return;
    // Atualiza no banco e recarrega o board.
    authClient
      .moveCrmLead({
        leadId: draggingId,
        stageId,
        ownerUsername: user?.username ?? null,
      })
      .then(() => refreshBoard())
      .catch((err) => console.error('Erro ao mover lead:', err))
      .finally(() => setDraggingId(null));
    setDraggingId(null);
  };

  const handleCreateLead = () => {
    setLeadForm({
      title: '',
      phone: '',
      cte: '',
      freteValue: '',
      source: 'WHATSAPP',
      priority: 'MEDIA',
    });
    setNewLeadOpen(true);
  };

  const handleSaveLead = () => {
    if (!leadForm.title.trim()) return;
    if (saveLeadLock.current) return;
    saveLeadLock.current = true;
    setIsSavingLead(true);
    const value = parseFloat(String(leadForm.freteValue).replace(',', '.')) || undefined;
    authClient
      .createCrmLead({
        title: leadForm.title.trim(),
        phone: leadForm.phone.trim() || null,
        cte: leadForm.cte.trim() || null,
        freteValue: value,
        source: leadForm.source,
        priority: leadForm.priority,
        ownerUsername: user?.username ?? null,
      })
      .then(() => refreshBoard())
      .catch((err) => console.error('Erro ao salvar lead:', err))
      .finally(() => {
        saveLeadLock.current = false;
        setIsSavingLead(false);
        setNewLeadOpen(false);
      });
  };

  const handleOpenPipelineModal = () => {
    setNewPipelineOpen(true);
  };

  const handleSavePipeline = () => {
    const cols = pipelineForm.columns
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length === 0) return;
    if (savePipelineLock.current) return;
    savePipelineLock.current = true;
    setIsSavingPipeline(true);
    authClient
      .createCrmPipeline({
        name: pipelineForm.name,
        columns: cols,
      })
      .then(() => refreshBoard())
      .catch((err) => console.error('Erro ao criar pipeline:', err))
      .finally(() => {
        savePipelineLock.current = false;
        setIsSavingPipeline(false);
        setNewPipelineOpen(false);
      });
  };

  const selectedLead = useMemo(
    () => (drawerLeadId ? leads.find((l) => l.id === drawerLeadId) || null : null),
    [drawerLeadId, leads]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <Columns3 size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white leading-tight">
              Funil de Atendimento CRM
            </h1>
            <p className="text-xs text-gray-400">
              Organize leads por estágio e prioridade, com foco em rastreio.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateLead}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A1B62] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(26,27,98,0.7)] hover:bg-[#EC1B23] hover:shadow-[0_0_22px_rgba(236,27,35,0.8)] transition-all"
          >
            <Plus size={16} />
            Novo Lead
          </button>
          <button
            type="button"
            onClick={handleOpenPipelineModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#080816] px-4 py-2 text-xs font-semibold text-gray-100 border border-[#1A1B62] hover:border-[#6E71DA] transition-colors"
          >
            <Columns3 size={16} />
            Criar Novo Funil
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[900px] h-full">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex-1 min-w-[220px] bg-[#070A20] border border-[#1E226F] rounded-xl flex flex-col max-h-full"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnStage(stage.id)}
            >
              <div className="px-3 py-3 border-b border-[#1A1B62] flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    {stage.name}
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {leadsByStage[stage.id]?.length || 0} leads
                  </p>
                </div>
                <div className="text-[10px] text-gray-300 text-right">
                  {(() => {
                    const total = (leadsByStage[stage.id] || [])
                      .map((l) => l.freteValue || 0)
                      .reduce((acc, v) => acc + v, 0);
                    return total > 0 ? formatCurrency(total) : 'R$ 0,00';
                  })()}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {leadsByStage[stage.id]?.map((lead) => {
                  const priority = priorityConfig[lead.priority];
                  const source = sourceConfig[lead.source];
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      onClick={() => setDrawerLeadId(lead.id)}
                      className={clsx(
                        'rounded-xl bg-[#080816] border border-[#1A1B62] p-3 shadow-[0_0_12px_rgba(0,0,0,0.6)] flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-transform',
                        draggingId === lead.id && 'opacity-70 scale-[0.98]'
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-bold text-xs md:text-sm truncate text-white">
                            {lead.title}
                          </div>
                          {typeof lead.freteValue === 'number' && (
                            <div className="text-[11px] font-mono text-emerald-300 mt-0.5">
                              R$ {lead.freteValue.toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[9px] font-bold border',
                              priority.className
                            )}
                          >
                            {priority.label}
                          </span>
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[9px] font-bold border',
                              source.className
                            )}
                          >
                            {source.label}
                          </span>
                        </div>
                      </div>
                      {lead.currentLocation && (
                        <div className="text-[11px] text-gray-300 mt-1 line-clamp-3 flex items-start gap-1.5">
                          <MapPin size={11} className="text-[#EC1B23] mt-0.5 shrink-0" />
                          <span>{lead.currentLocation}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-[#1A1B62] mt-1">
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onGoToChat?.(lead.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#070A20] border border-[#1E226F] text-gray-200 hover:border-[#6E71DA] hover:text-white text-[11px]"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (lead.cte) {
                                alert(`Abrir rastreio para CTE ${lead.cte}`);
                              }
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#070A20] border border-[#1E226F] text-gray-200 hover:border-[#6E71DA] hover:text-white text-[11px]"
                          >
                            <MapPin size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (lead.phone) {
                                window.open(`tel:${lead.phone.replace(/\s/g, '')}`);
                              }
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#070A20] border border-[#1E226F] text-gray-200 hover:border-[#6E71DA] hover:text-white text-[11px]"
                          >
                            <Phone size={14} />
                          </button>
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                          Arraste para outro estágio
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0) && (
                  <div className="text-[11px] text-gray-500 py-3 px-2 border border-dashed border-[#1A1B62] rounded-lg text-center">
                    Arraste um lead para cá
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {newLeadOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#070A20] border border-[#1E226F] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.92)] p-6">
            <h2 className="text-lg font-bold text-white mb-1">Novo Lead</h2>
            <p className="text-xs text-gray-400 mb-4">
              Preencha os dados iniciais para cadastrar um novo atendimento.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                  Nome
                </label>
                <input
                  className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                  value={leadForm.title}
                  onChange={(e) => setLeadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Razão social ou contato"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                    Telefone
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                    CTE (opcional)
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                    value={leadForm.cte}
                    onChange={(e) => setLeadForm((f) => ({ ...f, cte: e.target.value }))}
                    placeholder="12345"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                    Valor
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                    value={leadForm.freteValue}
                    onChange={(e) =>
                      setLeadForm((f) => ({ ...f, freteValue: e.target.value }))
                    }
                    placeholder="5300,00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                    Origem
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                    value={leadForm.source}
                    onChange={(e) =>
                      setLeadForm((f) => ({ ...f, source: e.target.value as Source }))
                    }
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IA">IA</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                    Prioridade
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                    value={leadForm.priority}
                    onChange={(e) =>
                      setLeadForm((f) => ({ ...f, priority: e.target.value as Priority }))
                    }
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewLeadOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-[#1E226F] text-gray-200 hover:bg-[#0F1440]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLead}
                disabled={isSavingLead}
                className="px-4 py-2 text-xs rounded-lg bg-[#1A1B62] text-white font-semibold shadow-[0_0_18px_rgba(26,27,98,0.8)] hover:bg-[#EC1B23] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingLead ? "Salvando..." : "Salvar Lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newPipelineOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#070A20] border border-[#1E226F] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.92)] p-6">
            <h2 className="text-lg font-bold text-white mb-1">Novo Funil</h2>
            <p className="text-xs text-gray-400 mb-4">
              Defina o nome e as colunas (separadas por vírgula) para o funil de atendimento.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                  Nome do Funil
                </label>
                <input
                  className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                  value={pipelineForm.name}
                  onChange={(e) =>
                    setPipelineForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex: Funil Comercial"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                  Colunas do Funil
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23] min-h-[70px] resize-none"
                  value={pipelineForm.columns}
                  onChange={(e) =>
                    setPipelineForm((f) => ({ ...f, columns: e.target.value }))
                  }
                  placeholder="Novos, Qualificando, Negociando, Fechado"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Separe as colunas por vírgulas na ordem desejada.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewPipelineOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-[#1E226F] text-gray-200 hover:bg-[#0F1440]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePipeline}
                disabled={isSavingPipeline}
                className="px-4 py-2 text-xs rounded-lg bg-[#1A1B62] text-white font-semibold shadow-[0_0_18px_rgba(26,27,98,0.8)] hover:bg-[#EC1B23] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingPipeline ? "Aplicando..." : "Aplicar Funil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-y-0 right-0 z-30 w-full sm:w-[380px] md:w-[420px] bg-[#070A20] border-l border-[#1E226F] shadow-[0_0_40px_rgba(0,0,0,0.92)] flex flex-col">
          <div className="px-4 py-3 border-b border-[#1A1B62] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">{selectedLead.title}</h2>
              <p className="text-[11px] text-gray-400">
                Detalhes do lead e histórico de movimento
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerLeadId(null)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Fechar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Contato</p>
              <p className="text-xs text-gray-200">
                Telefone: {selectedLead.phone || '—'}
              </p>
              <p className="text-xs text-gray-200">
                CTE vinculado: {selectedLead.cte || '—'}
              </p>
              <p className="text-xs text-gray-200">
                Valor do frete:{' '}
                {typeof selectedLead.freteValue === 'number'
                  ? formatCurrency(selectedLead.freteValue)
                  : '—'}
              </p>
            </div>
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                Localização atual
              </p>
              <p className="text-xs text-gray-200">
                {selectedLead.currentLocation || 'Sem informação de rastreio vinculada.'}
              </p>
            </div>
            {onGoToChat && (
              <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                    Ações rápidas
                  </p>
                  <p className="text-xs text-gray-300">
                    Ir direto para o chat deste lead no CRM.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onGoToChat(selectedLead.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1A1B62] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#EC1B23] shadow-[0_0_18px_rgba(26,27,98,0.8)]"
                >
                  <ArrowRightCircle size={14} />
                  Ir para Chat
                </button>
              </div>
            )}
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                Histórico de ações
              </p>
              {(selectedLead.logs || []).length === 0 ? (
                <p className="text-[11px] text-gray-500">
                  Nenhum log registrado ainda para este lead.
                </p>
              ) : (
                <ul className="space-y-1">
                  {selectedLead.logs?.map((log, idx) => (
                    <li key={idx} className="text-[11px] text-gray-200">
                      • {log}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmFunnel;

