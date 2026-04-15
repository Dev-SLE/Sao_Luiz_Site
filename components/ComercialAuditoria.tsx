import React, { useMemo, useState } from 'react';
import { RefreshCw, Sparkles, Save, History, MessageSquarePlus, Eye, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { authClient } from '../lib/auth';

type AuditoriaRow = {
  id: number;
  dataCobranca: string | null;
  agencia: string;
  percProjetado: number;
  statusAuditoria: string;
  motivoQueda: string;
  resumoResposta: string;
  planoAcao: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  responsavel: string;
  dataRetornoPrevista: string;
  retornoResponsavel: string;
  conclusao: string;
  resultadoEvolucao: 'MELHOROU' | 'ESTAVEL' | 'PIOROU' | 'NAO_AVALIADO';
  concluido: boolean;
  concluidoEm: string | null;
  dataAtualizacao: string | null;
};

type HistoryRow = {
  id: number;
  auditoriaId: number;
  acao: string;
  actor: string;
  note: string;
  previousStatus: string;
  nextStatus: string;
  createdAt: string | null;
};

type Tab = 'ACOES' | 'DOSSIE' | 'ACOMPANHAMENTO';
const STATUS_OPCOES = ['Aguardando Retorno', 'Plano Definido', 'Pendente Supervisor', 'Resolvido'];
const MOTIVOS = ['Concorrência / Preço', 'Cliente Faliu / Parou', 'Problema Operacional / Atrasos', 'Falta de Veículo', 'Mercado Fraco', 'Nenhum / Agência Voando'];
const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
const EVOLUCAO = ['MELHOROU', 'ESTAVEL', 'PIOROU', 'NAO_AVALIADO'] as const;

const badgeByPriority: Record<string, string> = {
  BAIXA: 'bg-slate-700/60 text-slate-100 border-slate-400/50',
  MEDIA: 'bg-sky-800/60 text-sky-100 border-sky-400/50',
  ALTA: 'bg-amber-800/60 text-amber-100 border-amber-400/50',
  CRITICA: 'bg-red-900/70 text-red-100 border-red-400/60',
};

const Modal: React.FC<{ open: boolean; title: string; onClose: () => void; children: React.ReactNode }> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-1 text-slate-600 hover:border-sl-navy/50 hover:text-sl-navy">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const ComercialAuditoria: React.FC = () => {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('ACOES');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [status, setStatus] = useState(STATUS_OPCOES[0]);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [resumo, setResumo] = useState('');
  const [plano, setPlano] = useState('');
  const [prioridade, setPrioridade] = useState<AuditoriaRow['prioridade']>('MEDIA');
  const [responsavel, setResponsavel] = useState('');
  const [dataRetornoPrevista, setDataRetornoPrevista] = useState('');
  const [retornoResponsavel, setRetornoResponsavel] = useState('');
  const [conclusao, setConclusao] = useState('');
  const [resultadoEvolucao, setResultadoEvolucao] = useState<AuditoriaRow['resultadoEvolucao']>('NAO_AVALIADO');
  const [concluido, setConcluido] = useState(false);
  const [historyNote, setHistoryNote] = useState('');
  const [openRecordModal, setOpenRecordModal] = useState(false);
  const [recordModalTab, setRecordModalTab] = useState<Tab>('ACOES');
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<HistoryRow | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const rowsByTab = useMemo(() => {
    if (tab === 'ACOES') return rows.filter((r) => !r.concluido);
    if (tab === 'DOSSIE') return rows;
    return rows.filter((r) => !!r.responsavel || !!r.dataRetornoPrevista || !r.concluido);
  }, [rows, tab]);

  const kpis = useMemo(() => {
    const pend = rows.filter((r) => !r.concluido).length;
    const concl = rows.filter((r) => r.concluido).length;
    const crit = rows.filter((r) => r.prioridade === 'CRITICA').length;
    const avg = rows.length ? rows.reduce((acc, r) => acc + Number(r.percProjetado || 0), 0) / rows.length : 0;
    return { pend, concl, crit, avg };
  }, [rows]);

  const showToast = (type: 'ok' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  const hydrate = (r: AuditoriaRow) => {
    setSelectedId(r.id);
    setStatus(r.statusAuditoria || STATUS_OPCOES[0]);
    setMotivo(r.motivoQueda || MOTIVOS[0]);
    setResumo(r.resumoResposta || '');
    setPlano(r.planoAcao || '');
    setPrioridade((r.prioridade || 'MEDIA') as AuditoriaRow['prioridade']);
    setResponsavel(r.responsavel || '');
    setDataRetornoPrevista(r.dataRetornoPrevista || '');
    setRetornoResponsavel(r.retornoResponsavel || '');
    setConclusao(r.conclusao || '');
    setResultadoEvolucao((r.resultadoEvolucao || 'NAO_AVALIADO') as AuditoriaRow['resultadoEvolucao']);
    setConcluido(!!r.concluido);
  };

  const loadHistory = async (auditoriaId: number) => {
    try {
      const resp = await authClient.getComercialAuditoriaHistory(auditoriaId);
      setHistoryRows((resp?.rows || []) as HistoryRow[]);
    } catch {
      setHistoryRows([]);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const resp = await authClient.getComercialAuditorias({ limit: 800 });
      const list = (resp?.rows || []) as AuditoriaRow[];
      setRows(list);
      if (!list.length) {
        setSelectedId(null);
        setHistoryRows([]);
        return;
      }
      const keep = list.find((x) => x.id === selectedId) || list[0];
      hydrate(keep);
      await loadHistory(keep.id);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Falha ao carregar auditorias.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onView = (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    hydrate(row);
    void loadHistory(row.id);
    setRecordModalTab(tab);
    setOpenRecordModal(true);
  };

  const saveAcoes = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await authClient.saveComercialAuditoria({
        id: selected.id,
        statusAuditoria: status,
        motivoQueda: motivo,
        resumoResposta: resumo,
        planoAcao: plano,
        prioridade,
        responsavel,
        dataRetornoPrevista,
        retornoResponsavel,
        conclusao,
        resultadoEvolucao,
        concluido,
        actor: 'UI_COMERCIAL',
      });
      await load();
      showToast('ok', 'Ações salvas com sucesso.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const saveAcompanhamento = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await authClient.saveComercialAuditoria({
        id: selected.id,
        statusAuditoria: status,
        motivoQueda: motivo,
        resumoResposta: resumo,
        planoAcao: plano,
        prioridade,
        responsavel,
        dataRetornoPrevista,
        retornoResponsavel,
        conclusao,
        resultadoEvolucao,
        concluido,
        actor: 'UI_COMERCIAL_ACOMPANHAMENTO',
      });
      await load();
      showToast('ok', 'Acompanhamento salvo com sucesso.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao salvar acompanhamento.');
    } finally {
      setSaving(false);
    }
  };

  const suggestPlan = async () => {
    if (!selected) return;
    setSuggesting(true);
    try {
      const resp = await authClient.suggestComercialPlano({
        agencia: selected.agencia,
        percProjetado: selected.percProjetado,
        motivoQueda: motivo,
        resumoResposta: resumo,
      });
      const suggestion = String(resp?.suggestion || '').trim();
      if (!suggestion) {
        showToast('error', 'A IA não retornou sugestão.');
        return;
      }
      setPlano(suggestion);
      showToast('ok', 'Plano sugerido pela IA preenchido.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao sugerir plano.');
    } finally {
      setSuggesting(false);
    }
  };

  const addHistory = async () => {
    if (!selected || !historyNote.trim()) return;
    setSavingHistory(true);
    try {
      await authClient.addComercialAuditoriaHistory({
        auditoriaId: selected.id,
        acao: 'RETORNO_RESPONSAVEL',
        actor: responsavel || 'RESPONSAVEL_NAO_INFORMADO',
        note: historyNote.trim(),
      });
      setHistoryNote('');
      await loadHistory(selected.id);
      showToast('ok', 'Evento adicionado ao dossiê.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao registrar histórico.');
    } finally {
      setSavingHistory(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-slate-900">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Pendentes</p>
          <p className="text-xl font-black text-slate-900">{kpis.pend}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Concluídas</p>
          <p className="text-xl font-black text-emerald-700">{kpis.concl}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Críticas</p>
          <p className="text-xl font-black text-red-600">{kpis.crit}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">% médio projetado</p>
          <p className="text-xl font-black text-sky-700">{kpis.avg.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black">Comercial - Auditoria de Metas</h1>
          <p className="text-xs text-slate-500">Layout executivo com subabas, ações rápidas e modais de trabalho.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="flex gap-2">
        <button className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${tab === 'ACOES' ? 'bg-sl-navy border-sl-navy/50 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`} onClick={() => setTab('ACOES')}>Ações</button>
        <button className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${tab === 'DOSSIE' ? 'bg-sl-navy border-sl-navy/50 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`} onClick={() => setTab('DOSSIE')}>Dossiê</button>
        <button className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${tab === 'ACOMPANHAMENTO' ? 'bg-sl-navy border-sl-navy/50 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`} onClick={() => setTab('ACOMPANHAMENTO')}>Acompanhamento</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-black text-slate-900">
          {tab === 'ACOES' ? 'Ações em aberto' : tab === 'DOSSIE' ? 'Dossiês de auditoria' : 'Acompanhamentos'}
        </h2>
        <div className="max-h-[620px] overflow-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Agência</th>
                {tab === 'ACOES' && <th className="px-3 py-2 text-left">% Proj.</th>}
                {tab !== 'ACOES' && <th className="px-3 py-2 text-left">Prioridade</th>}
                {tab === 'ACOMPANHAMENTO' && <th className="px-3 py-2 text-left">Responsável</th>}
                <th className="px-3 py-2 text-left">{tab === 'DOSSIE' ? 'Atualização' : 'Status'}</th>
                <th className="px-3 py-2 text-left">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rowsByTab.map((r) => (
                <tr key={r.id} className={selectedId === r.id ? 'bg-sl-navy/10' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">{r.agencia}</td>
                  {tab === 'ACOES' && <td className="px-3 py-2">{Number(r.percProjetado || 0).toFixed(1)}%</td>}
                  {tab !== 'ACOES' && (
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-bold ${badgeByPriority[r.prioridade] || badgeByPriority.MEDIA}`}>{r.prioridade}</span>
                    </td>
                  )}
                  {tab === 'ACOMPANHAMENTO' && <td className="px-3 py-2">{r.responsavel || '-'}</td>}
                  <td className="px-3 py-2">{tab === 'DOSSIE' ? (r.dataAtualizacao ? new Date(r.dataAtualizacao).toLocaleDateString('pt-BR') : '-') : r.statusAuditoria}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => onView(r.id)} className="inline-flex items-center gap-1 rounded-md bg-sl-navy px-2 py-1 font-bold text-white hover:bg-sl-navy-light">
                      <Eye size={12} />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {!rowsByTab.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">Sem itens nesta subaba.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={openRecordModal && !!selected} onClose={() => setOpenRecordModal(false)} title={`${recordModalTab === 'ACOES' ? 'Ações' : recordModalTab === 'DOSSIE' ? 'Dossiê' : 'Acompanhamento'} - ${selected?.agencia || ''}`}>
        {!selected ? null : (
          <div className="space-y-3">
            {recordModalTab === 'ACOES' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 uppercase tracking-wide">Status da auditoria</label>
                    <select className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPCOES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 uppercase tracking-wide">Causa raiz</label>
                    <select className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                      {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 uppercase tracking-wide">Resumo do áudio/retorno</label>
                  <textarea className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 min-h-[100px] resize-y outline-none" value={resumo} onChange={(e) => setResumo(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <button onClick={() => void suggestPlan()} disabled={suggesting} className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60">
                    <Sparkles size={14} />
                    {suggesting ? 'Sugerindo...' : 'Sugerir Plano com IA'}
                  </button>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 uppercase tracking-wide">Plano de ação</label>
                  <textarea className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 min-h-[180px] resize-y outline-none" value={plano} onChange={(e) => setPlano(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <button onClick={() => void saveAcoes()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60">
                    <Save size={14} />
                    {saving ? 'Salvando...' : 'Salvar Ações'}
                  </button>
                </div>
              </>
            )}

            {recordModalTab === 'DOSSIE' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900"><History size={14} /> Histórico de eventos</div>
                <div className="max-h-[280px] overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Ação</th>
                        <th className="px-3 py-2 text-left">Ator</th>
                        <th className="px-3 py-2 text-left">Detalhe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {historyRows.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-100">
                          <td className="px-3 py-2">{h.createdAt ? new Date(h.createdAt).toLocaleString('pt-BR') : '-'}</td>
                          <td className="px-3 py-2">{h.acao}</td>
                          <td className="px-3 py-2">{h.actor || '-'}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => setSelectedHistoryDetail(h)} className="inline-flex items-center gap-1 rounded-md bg-sl-navy px-2 py-1 font-bold text-white hover:bg-sl-navy-light">
                              <Eye size={12} />
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!historyRows.length && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-500">Sem histórico registrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 uppercase tracking-wide">Novo evento do dossiê</label>
                  <textarea className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 min-h-[90px] resize-y outline-none" value={historyNote} onChange={(e) => setHistoryNote(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <button onClick={() => void addHistory()} disabled={savingHistory || !historyNote.trim()} className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60">
                    <MessageSquarePlus size={14} />
                    {savingHistory ? 'Registrando...' : 'Registrar Evento'}
                  </button>
                </div>
              </div>
            )}

            {recordModalTab === 'ACOMPANHAMENTO' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 uppercase tracking-wide">Prioridade</label>
                    <select className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none" value={prioridade} onChange={(e) => setPrioridade(e.target.value as AuditoriaRow['prioridade'])}>
                      {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 uppercase tracking-wide">Responsável</label>
                    <input className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 uppercase tracking-wide">Prazo de retorno</label>
                    <input type="date" className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none" value={dataRetornoPrevista} onChange={(e) => setDataRetornoPrevista(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 uppercase tracking-wide">Evolução</label>
                    <select className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none" value={resultadoEvolucao} onChange={(e) => setResultadoEvolucao(e.target.value as AuditoriaRow['resultadoEvolucao'])}>
                      {EVOLUCAO.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" checked={concluido} onChange={(e) => setConcluido(e.target.checked)} />
                      Concluir auditoria
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 uppercase tracking-wide">Retorno do responsável</label>
                  <textarea className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 min-h-[90px] resize-y outline-none" value={retornoResponsavel} onChange={(e) => setRetornoResponsavel(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 uppercase tracking-wide">Conclusão final</label>
                  <textarea className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 min-h-[90px] resize-y outline-none" value={conclusao} onChange={(e) => setConclusao(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <button onClick={() => void saveAcompanhamento()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60">
                    <Save size={14} />
                    {saving ? 'Salvando...' : 'Salvar Acompanhamento'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!selectedHistoryDetail} onClose={() => setSelectedHistoryDetail(null)} title="Detalhes do evento do dossiê">
        {!selectedHistoryDetail ? null : (
          <div className="space-y-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-slate-600">Data: <span className="font-medium text-slate-900">{selectedHistoryDetail.createdAt ? new Date(selectedHistoryDetail.createdAt).toLocaleString('pt-BR') : '-'}</span></p>
              <p className="text-slate-600">Ação: <span className="font-medium text-slate-900">{selectedHistoryDetail.acao}</span></p>
              <p className="text-slate-600">Ator: <span className="font-medium text-slate-900">{selectedHistoryDetail.actor || '-'}</span></p>
              <p className="text-slate-600">Status anterior: <span className="font-medium text-slate-900">{selectedHistoryDetail.previousStatus || '-'}</span></p>
              <p className="text-slate-600">Status novo: <span className="font-medium text-slate-900">{selectedHistoryDetail.nextStatus || '-'}</span></p>
            </div>
            <div>
              <label className="text-[11px] text-slate-600 uppercase tracking-wide">Nota registrada</label>
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800 whitespace-pre-wrap">
                {selectedHistoryDetail.note || '-'}
              </div>
            </div>
          </div>
        )}
      </Modal>
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-md ${toast.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
          {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default ComercialAuditoria;

