import React, { useEffect, useState } from 'react';
import { authClient } from '../lib/auth';

interface SofiaSettingsState {
  name: string;
  welcome: string;
  knowledgeBase: string;
  days: Record<string, boolean>;
  autoReplyEnabled: boolean;
  modelName: string;
  escalationKeywords: string;
  autoMode: 'ASSISTIDO' | 'SEMI_AUTO' | 'AUTO_TOTAL';
  minConfidence: number;
  maxAutoRepliesPerConversation: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  blockedTopics: string;
  blockedStatuses: string;
  requireHumanIfSlaBreached: boolean;
  requireHumanAfterCustomerMessages: number;
}

const defaultState: SofiaSettingsState = {
  name: 'Sofia',
  welcome: 'Olá! Sou a Sofia, assistente virtual da São Luiz Express. Como posso te ajudar hoje?',
  knowledgeBase: '',
  days: {
    segunda: true,
    terca: true,
    quarta: true,
    quinta: true,
    sexta: true,
    sabado: false,
    domingo: false,
  },
  autoReplyEnabled: false,
  modelName: 'gpt-4o-mini',
  escalationKeywords: 'reclamação, advogado, processo, procon',
  autoMode: 'ASSISTIDO',
  minConfidence: 70,
  maxAutoRepliesPerConversation: 2,
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
  blockedTopics: 'JURIDICO, EXTRAVIO',
  blockedStatuses: 'PERDIDO, AGUARDANDO_RETORNO_AGENCIA',
  requireHumanIfSlaBreached: true,
  requireHumanAfterCustomerMessages: 4,
};

const SofiaSettings: React.FC = () => {
  const [state, setState] = useState<SofiaSettingsState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const api = await authClient.getSofiaSettings().catch(() => null);
        if (api?.settings) {
          const s = api.settings;
          setState((prev) => ({
            ...prev,
            name: s.name || prev.name,
            welcome: s.welcome || prev.welcome,
            knowledgeBase: s.knowledgeBase || prev.knowledgeBase,
            days: { ...prev.days, ...(s.activeDays || {}) },
            autoReplyEnabled: !!s.autoReplyEnabled,
            modelName: s.modelName || prev.modelName,
            escalationKeywords: Array.isArray(s.escalationKeywords) ? s.escalationKeywords.join(', ') : prev.escalationKeywords,
            autoMode: (s.autoMode || prev.autoMode) as SofiaSettingsState['autoMode'],
            minConfidence: Number(s.minConfidence ?? prev.minConfidence),
            maxAutoRepliesPerConversation: Number(s.maxAutoRepliesPerConversation ?? prev.maxAutoRepliesPerConversation),
            businessHoursStart: s.businessHoursStart || prev.businessHoursStart,
            businessHoursEnd: s.businessHoursEnd || prev.businessHoursEnd,
            blockedTopics: Array.isArray(s.blockedTopics) ? s.blockedTopics.join(', ') : prev.blockedTopics,
            blockedStatuses: Array.isArray(s.blockedStatuses) ? s.blockedStatuses.join(', ') : prev.blockedStatuses,
            requireHumanIfSlaBreached: s.requireHumanIfSlaBreached === undefined ? prev.requireHumanIfSlaBreached : !!s.requireHumanIfSlaBreached,
            requireHumanAfterCustomerMessages: Number(s.requireHumanAfterCustomerMessages ?? prev.requireHumanAfterCustomerMessages),
          }));
        }
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : 'Falha ao carregar configurações da Sofia.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handleSaveServer = async () => {
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await authClient.saveSofiaSettings({
        name: state.name,
        welcome: state.welcome,
        knowledgeBase: state.knowledgeBase,
        activeDays: state.days,
        autoReplyEnabled: state.autoReplyEnabled,
        modelName: state.modelName,
        escalationKeywords: state.escalationKeywords.split(',').map((x) => x.trim()).filter(Boolean),
        autoMode: state.autoMode,
        minConfidence: state.minConfidence,
        maxAutoRepliesPerConversation: state.maxAutoRepliesPerConversation,
        businessHoursStart: state.businessHoursStart,
        businessHoursEnd: state.businessHoursEnd,
        blockedTopics: state.blockedTopics.split(',').map((x) => x.trim()).filter(Boolean),
        blockedStatuses: state.blockedStatuses.split(',').map((x) => x.trim()).filter(Boolean),
        requireHumanIfSlaBreached: state.requireHumanIfSlaBreached,
        requireHumanAfterCustomerMessages: state.requireHumanAfterCustomerMessages,
      });
      setSuccessText('Configurações salvas com sucesso no servidor.');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Erro ao salvar configurações da Sofia.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setState((prev) => ({
      ...prev,
      days: { ...prev.days, [day]: !prev.days[day] },
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-white">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
          <span className="text-sm font-black">IA</span>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Configurações da Sofia</h1>
          <p className="text-xs text-gray-400">
            Defina identidade, conhecimento e horários em que a IA atende sozinha.
          </p>
        </div>
      </div>
      {errorText && (
        <div className="rounded-xl border border-red-500/60 bg-red-950/40 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-red-200">{errorText}</p>
            <button
              type="button"
              onClick={() => navigator?.clipboard?.writeText(errorText)}
              className="text-[11px] rounded border border-red-400/50 px-2 py-1 text-red-200 hover:bg-red-900/40"
            >
              Copiar erro
            </button>
          </div>
        </div>
      )}
      {successText && (
        <div className="rounded-xl border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {successText}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 space-y-3 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
          <h2 className="text-sm font-bold text-white mb-1">Identidade</h2>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Nome da Assistente</label>
              <p className="text-[11px] text-gray-400">Nome exibido no chat para respostas automáticas.</p>
              <input
                className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Mensagem de Boas-vindas</label>
              <p className="text-[11px] text-gray-400">Mensagem inicial enviada ao iniciar uma conversa.</p>
              <textarea
                className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none min-h-[80px] resize-none focus:ring-1 focus:ring-[#EC1B23]"
                value={state.welcome}
                onChange={(e) => setState((s) => ({ ...s, welcome: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 space-y-3 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
          <h2 className="text-sm font-bold text-white mb-1">Horários de Atendimento</h2>
          <p className="text-[11px] text-gray-400 mb-2">
            Selecione os dias em que a Sofia pode responder sozinha (sem intervenção humana).
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['segunda', 'Segunda-feira'],
              ['terca', 'Terça-feira'],
              ['quarta', 'Quarta-feira'],
              ['quinta', 'Quinta-feira'],
              ['sexta', 'Sexta-feira'],
              ['sabado', 'Sábado'],
              ['domingo', 'Domingo'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={
                  state.days[key]
                    ? 'px-3 py-2 rounded-lg bg-emerald-700 text-white border border-emerald-500 font-semibold'
                    : 'px-3 py-2 rounded-lg bg-[#080816] text-gray-300 border border-[#1A1B62] hover:border-[#6E71DA]'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-[#1A1B62] space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-300 uppercase tracking-wide">Modo de Operação</label>
                <p className="text-[11px] text-gray-400">Define quando a Sofia pode responder automaticamente.</p>
                <select
                className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
                value={state.autoMode}
                onChange={(e) => setState((s) => ({ ...s, autoMode: e.target.value as SofiaSettingsState['autoMode'] }))}
              >
                <option value="ASSISTIDO">Assistido (só sugestão)</option>
                <option value="SEMI_AUTO">Semi-auto (humano confirma)</option>
                <option value="AUTO_TOTAL">Auto total (com governança)</option>
              </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-300 uppercase tracking-wide">Confiança mínima (%)</label>
                <p className="text-[11px] text-gray-400">Abaixo deste valor, a IA não envia sozinha.</p>
                <input
                type="number"
                className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
                value={state.minConfidence}
                onChange={(e) => setState((s) => ({ ...s, minConfidence: Number(e.target.value) || 70 }))}
                placeholder="Ex: 70"
              />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Resposta automática</label>
              <p className="text-[11px] text-gray-400">Ativa ou desativa a Sofia para respostas automáticas.</p>
              <select
                className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
                value={state.autoReplyEnabled ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, autoReplyEnabled: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Modelo da IA</label>
              <p className="text-[11px] text-gray-400">Escolha o modelo da OpenAI utilizado na geração de respostas.</p>
              <select
              className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
              value={state.modelName}
              onChange={(e) => setState((s) => ({ ...s, modelName: e.target.value }))}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (rápido e econômico)</option>
              <option value="gpt-4.1">gpt-4.1 (mais preciso)</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini (equilibrado)</option>
            </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-300 uppercase tracking-wide">Início do atendimento</label>
                <input
                type="time"
                className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
                value={state.businessHoursStart}
                onChange={(e) => setState((s) => ({ ...s, businessHoursStart: e.target.value }))}
              />
              </div>
              <div>
                <label className="text-[11px] text-gray-300 uppercase tracking-wide">Fim do atendimento</label>
                <input
                type="time"
                className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
                value={state.businessHoursEnd}
                onChange={(e) => setState((s) => ({ ...s, businessHoursEnd: e.target.value }))}
              />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Máximo de respostas automáticas</label>
              <p className="text-[11px] text-gray-400">Limite de respostas consecutivas da Sofia por conversa.</p>
              <input
              type="number"
              className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
              value={state.maxAutoRepliesPerConversation}
              onChange={(e) => setState((s) => ({ ...s, maxAutoRepliesPerConversation: Number(e.target.value) || 2 }))}
              placeholder="Ex: 2"
            />
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Escalar após X mensagens do cliente</label>
              <p className="text-[11px] text-gray-400">Quando exceder este número, exige atendimento humano.</p>
              <input
              type="number"
              className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
              value={state.requireHumanAfterCustomerMessages}
              onChange={(e) => setState((s) => ({ ...s, requireHumanAfterCustomerMessages: Number(e.target.value) || 4 }))}
              placeholder="Ex: 4"
            />
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Escalar quando SLA estourar</label>
              <select
                className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
                value={state.requireHumanIfSlaBreached ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, requireHumanIfSlaBreached: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 space-y-2 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
        <h2 className="text-sm font-bold text-white mb-1">Base de Conhecimento</h2>
        <p className="text-[11px] text-gray-400 mb-2">
          Cole aqui as regras de negócio, políticas de prazo, tipos de carga aceitos, instruções de
          atendimento e qualquer contexto que a Sofia deve seguir.
        </p>
        <p className="text-[11px] text-gray-400 mb-2">
          Chave da IA (OpenAI) é controlada no ambiente do servidor (`.env`) por segurança e não é salva nesta tela.
        </p>
        <textarea
          className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none min-h-[180px] resize-y focus:ring-1 focus:ring-[#EC1B23]"
          value={state.knowledgeBase}
          onChange={(e) => setState((s) => ({ ...s, knowledgeBase: e.target.value }))}
          placeholder="Exemplo:&#10;- Prazos de entrega por UF...&#10;- Tipos de carga proibidos...&#10;- Como responder sobre TAD, EM BUSCA, CRÍTICO..."
        />
        <input
          className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
          value={state.escalationKeywords}
          onChange={(e) => setState((s) => ({ ...s, escalationKeywords: e.target.value }))}
          placeholder="Palavras para escalar para humano (separadas por vírgula)"
        />
        <input
          className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
          value={state.blockedTopics}
          onChange={(e) => setState((s) => ({ ...s, blockedTopics: e.target.value }))}
          placeholder="Tópicos bloqueados para auto (ex: JURIDICO, EXTRAVIO)"
        />
        <input
          className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none"
          value={state.blockedStatuses}
          onChange={(e) => setState((s) => ({ ...s, blockedStatuses: e.target.value }))}
          placeholder="Status bloqueados (ex: PERDIDO, CONCLUIDO)"
        />
        <p className="text-[11px] text-gray-400">
          Dica: mantenha <strong>AGUARDANDO_RETORNO_AGENCIA</strong> bloqueado para a Sofia não responder em fluxos que dependem de retorno da agência.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveServer}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#1A1B62] text-white text-xs font-semibold hover:bg-[#EC1B23]"
        >
          {saving ? 'Salvando...' : 'Salvar no servidor'}
        </button>
      </div>

      <p className="text-[11px] text-gray-500">As configurações são persistidas no servidor (banco) ao clicar em "Salvar no servidor".</p>
      {loading && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-[#2B2F8F] bg-[#070A20] px-3 py-2 text-xs text-gray-100 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
          Carregando configurações da Sofia...
        </div>
      )}
    </div>
  );
};

export default SofiaSettings;

