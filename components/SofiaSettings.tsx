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
  systemInstructions: string;
  fallbackMessage: string;
  handoffMessage: string;
  responseTone: 'PROFISSIONAL' | 'EMPATICO' | 'DIRETO';
  maxResponseChars: number;
  welcomeEnabled: boolean;
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
  systemInstructions: 'Sempre confirme dados críticos antes de afirmar prazo final. Em caso de incerteza, escale para humano.',
  fallbackMessage: 'Recebi sua mensagem e já estou validando os detalhes para te responder com segurança.',
  handoffMessage: 'Vou encaminhar seu atendimento para nossa equipe humana agora para seguirmos com prioridade.',
  responseTone: 'PROFISSIONAL',
  maxResponseChars: 480,
  welcomeEnabled: true,
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
            systemInstructions: s.systemInstructions || prev.systemInstructions,
            fallbackMessage: s.fallbackMessage || prev.fallbackMessage,
            handoffMessage: s.handoffMessage || prev.handoffMessage,
            responseTone: (s.responseTone || prev.responseTone) as SofiaSettingsState['responseTone'],
            maxResponseChars: Number(s.maxResponseChars ?? prev.maxResponseChars),
            welcomeEnabled: s.welcomeEnabled === undefined ? prev.welcomeEnabled : !!s.welcomeEnabled,
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
        systemInstructions: state.systemInstructions,
        fallbackMessage: state.fallbackMessage,
        handoffMessage: state.handoffMessage,
        responseTone: state.responseTone,
        maxResponseChars: state.maxResponseChars,
        welcomeEnabled: state.welcomeEnabled,
      });
      setSuccessText('Configurações salvas com sucesso no servidor.');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Erro ao salvar configurações da Sofia.');
    } finally {
      setSaving(false);
    }
  };

  const applyOfficialTemplate = async () => {
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await authClient.applySofiaTemplate();
      const api = await authClient.getSofiaSettings();
      const s = api?.settings;
      if (s) {
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
          systemInstructions: s.systemInstructions || prev.systemInstructions,
          fallbackMessage: s.fallbackMessage || prev.fallbackMessage,
          handoffMessage: s.handoffMessage || prev.handoffMessage,
          responseTone: (s.responseTone || prev.responseTone) as SofiaSettingsState['responseTone'],
          maxResponseChars: Number(s.maxResponseChars ?? prev.maxResponseChars),
          welcomeEnabled: s.welcomeEnabled === undefined ? prev.welcomeEnabled : !!s.welcomeEnabled,
        }));
      }
      setSuccessText('Template oficial da Sofia aplicado e salvo no banco.');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Erro ao aplicar template oficial da Sofia.');
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
    <div className="space-y-6 animate-in fade-in duration-500 text-slate-900">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-[#e42424] border border-slate-200 shadow-[0_0_18px_rgba(236,27,35,0.4)]">
          <span className="text-sm font-black">IA</span>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Configurações da Sofia</h1>
          <p className="text-xs text-slate-600">
            Defina identidade, conhecimento e horários em que a IA atende sozinha.
          </p>
        </div>
      </div>
      {errorText && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-red-800">{errorText}</p>
            <button
              type="button"
              onClick={() => navigator?.clipboard?.writeText(errorText)}
              className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
            >
              Copiar erro
            </button>
          </div>
        </div>
      )}
      {successText && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {successText}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-[#2c348c]/20 bg-gradient-to-b from-white to-[#f7faff] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
          <h2 className="mb-1 text-sm font-bold text-slate-900">Identidade</h2>
          <div className="space-y-2">
            <div>
              <label className="text-ui-label">Nome da Assistente</label>
              <p className="text-[11px] text-slate-600">Nome exibido no chat para respostas automáticas.</p>
              <input
                className="field-ui mt-1 w-full"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-ui-label">Mensagem de Boas-vindas</label>
              <p className="text-[11px] text-slate-600">Mensagem inicial enviada ao iniciar uma conversa.</p>
              <select
                className="field-ui mb-2 mt-1 w-full"
                value={state.welcomeEnabled ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, welcomeEnabled: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Boas-vindas ativas</option>
                <option value="NAO">Boas-vindas desativadas</option>
              </select>
              <textarea
                className="field-ui mt-1 min-h-[88px] w-full resize-none"
                value={state.welcome}
                onChange={(e) => setState((s) => ({ ...s, welcome: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#2c348c]/20 bg-gradient-to-b from-white to-[#f7faff] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
          <h2 className="mb-1 text-sm font-bold text-slate-900">Horários de Atendimento</h2>
          <p className="mb-2 text-[11px] text-slate-600">
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
                    : 'px-3 py-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:border-[#2c348c]/45'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="text-ui-label">Modo de Operação</label>
                <p className="text-[11px] text-slate-600">Define quando a Sofia pode responder automaticamente.</p>
                <select
                className="field-ui w-full"
                value={state.autoMode}
                onChange={(e) => setState((s) => ({ ...s, autoMode: e.target.value as SofiaSettingsState['autoMode'] }))}
              >
                <option value="ASSISTIDO">Assistido (só sugestão)</option>
                <option value="SEMI_AUTO">Semi-auto (humano confirma)</option>
                <option value="AUTO_TOTAL">Auto total (com governança)</option>
              </select>
              </div>
              <div>
                <label className="text-ui-label">Confiança mínima (%)</label>
                <p className="text-[11px] text-slate-600">Abaixo deste valor, a IA não envia sozinha.</p>
                <input
                type="number"
                className="field-ui w-full"
                value={state.minConfidence}
                onChange={(e) => setState((s) => ({ ...s, minConfidence: Number(e.target.value) || 70 }))}
                placeholder="Ex: 70"
              />
              </div>
            </div>
            <div>
              <label className="text-ui-label">Resposta automática</label>
              <p className="text-[11px] text-slate-600">Ativa ou desativa a Sofia para respostas automáticas.</p>
              <select
                className="field-ui w-full"
                value={state.autoReplyEnabled ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, autoReplyEnabled: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>
            <div>
              <label className="text-ui-label">Modelo da IA</label>
              <p className="text-[11px] text-slate-600">Escolha o modelo da OpenAI utilizado na geração de respostas.</p>
              <select
              className="field-ui w-full"
              value={state.modelName}
              onChange={(e) => setState((s) => ({ ...s, modelName: e.target.value }))}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (rápido e econômico)</option>
              <option value="gpt-4.1">gpt-4.1 (mais preciso)</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini (equilibrado)</option>
            </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="text-ui-label">Tom de Resposta</label>
                <p className="text-[11px] text-slate-600">Estilo padrão de escrita da Sofia.</p>
                <select
                  className="field-ui w-full"
                  value={state.responseTone}
                  onChange={(e) => setState((s) => ({ ...s, responseTone: e.target.value as SofiaSettingsState['responseTone'] }))}
                >
                  <option value="PROFISSIONAL">Profissional</option>
                  <option value="EMPATICO">Empático</option>
                  <option value="DIRETO">Direto</option>
                </select>
              </div>
              <div>
                <label className="text-ui-label">Máx. caracteres por resposta</label>
                <p className="text-[11px] text-slate-600">Evita respostas longas demais no WhatsApp.</p>
                <input
                  type="number"
                  className="field-ui w-full"
                  value={state.maxResponseChars}
                  onChange={(e) => setState((s) => ({ ...s, maxResponseChars: Number(e.target.value) || 480 }))}
                  placeholder="Ex: 480"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-ui-label">Início do atendimento</label>
                <input
                type="time"
                className="field-ui w-full"
                value={state.businessHoursStart}
                onChange={(e) => setState((s) => ({ ...s, businessHoursStart: e.target.value }))}
              />
              </div>
              <div>
                <label className="text-ui-label">Fim do atendimento</label>
                <input
                type="time"
                className="field-ui w-full"
                value={state.businessHoursEnd}
                onChange={(e) => setState((s) => ({ ...s, businessHoursEnd: e.target.value }))}
              />
              </div>
            </div>
            <div>
              <label className="text-ui-label">Máximo de respostas automáticas</label>
              <p className="text-[11px] text-slate-600">Limite de respostas consecutivas da Sofia por conversa.</p>
              <input
              type="number"
              className="field-ui w-full"
              value={state.maxAutoRepliesPerConversation}
              onChange={(e) => setState((s) => ({ ...s, maxAutoRepliesPerConversation: Number(e.target.value) || 2 }))}
              placeholder="Ex: 2"
            />
            </div>
            <div>
              <label className="text-ui-label">Escalar após X mensagens do cliente</label>
              <p className="text-[11px] text-slate-600">Quando exceder este número, exige atendimento humano.</p>
              <input
              type="number"
              className="field-ui w-full"
              value={state.requireHumanAfterCustomerMessages}
              onChange={(e) => setState((s) => ({ ...s, requireHumanAfterCustomerMessages: Number(e.target.value) || 4 }))}
              placeholder="Ex: 4"
            />
            </div>
            <div>
              <label className="text-ui-label">Escalar quando SLA estourar</label>
              <select
                className="field-ui w-full"
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

      <div className="space-y-2 rounded-xl border border-[#2c348c]/20 bg-gradient-to-b from-white to-[#f7faff] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
        <h2 className="mb-1 text-sm font-bold text-slate-900">Base de Conhecimento</h2>
        <p className="mb-2 text-[11px] text-slate-600">
          Cole aqui as regras de negócio, políticas de prazo, tipos de carga aceitos, instruções de
          atendimento e qualquer contexto que a Sofia deve seguir.
        </p>
        <p className="mb-2 text-[11px] text-slate-600">
          Chave da IA (OpenAI) é controlada no ambiente do servidor (`.env`) por segurança e não é salva nesta tela.
        </p>
        <textarea
          className="field-ui min-h-[180px] w-full resize-y"
          value={state.knowledgeBase}
          onChange={(e) => setState((s) => ({ ...s, knowledgeBase: e.target.value }))}
          placeholder="Exemplo:&#10;- Prazos de entrega por UF...&#10;- Tipos de carga proibidos...&#10;- Como responder sobre TAD, EM BUSCA, CRÍTICO..."
        />
        <input
          className="field-ui w-full"
          value={state.escalationKeywords}
          onChange={(e) => setState((s) => ({ ...s, escalationKeywords: e.target.value }))}
          placeholder="Palavras para escalar para humano (separadas por vírgula)"
        />
        <input
          className="field-ui w-full"
          value={state.blockedTopics}
          onChange={(e) => setState((s) => ({ ...s, blockedTopics: e.target.value }))}
          placeholder="Tópicos bloqueados para auto (ex: JURIDICO, EXTRAVIO)"
        />
        <input
          className="field-ui w-full"
          value={state.blockedStatuses}
          onChange={(e) => setState((s) => ({ ...s, blockedStatuses: e.target.value }))}
          placeholder="Status bloqueados (ex: PERDIDO, CONCLUIDO)"
        />
        <p className="text-[11px] text-slate-600">
          Dica: mantenha <strong>AGUARDANDO_RETORNO_AGENCIA</strong> bloqueado para a Sofia não responder em fluxos que dependem de retorno da agência.
        </p>
        <div>
          <label className="text-ui-label">Instruções do Supervisor (Prompt Base)</label>
          <p className="text-[11px] text-slate-600">Regras fixas de linguagem, compliance e conduta da Sofia.</p>
          <textarea
            className="field-ui min-h-[100px] w-full resize-y"
            value={state.systemInstructions}
            onChange={(e) => setState((s) => ({ ...s, systemInstructions: e.target.value }))}
            placeholder="Ex: Nunca informar prazo final sem confirmar status atual do CTE no histórico."
          />
        </div>
        <div>
          <label className="text-ui-label">Mensagem de fallback</label>
          <p className="text-[11px] text-slate-600">Usada quando a OpenAI não responder a tempo ou vier vazia.</p>
          <textarea
            className="field-ui min-h-[70px] w-full resize-y"
            value={state.fallbackMessage}
            onChange={(e) => setState((s) => ({ ...s, fallbackMessage: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-ui-label">Mensagem de handoff (escalonamento)</label>
          <p className="text-[11px] text-slate-600">Mensagem padrão quando a governança bloquear autoenvio e passar para humano.</p>
          <textarea
            className="field-ui min-h-[70px] w-full resize-y"
            value={state.handoffMessage}
            onChange={(e) => setState((s) => ({ ...s, handoffMessage: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={applyOfficialTemplate}
          disabled={saving}
          className="btn-ui-secondary mr-2 px-4 py-2"
        >
          {saving ? 'Aplicando...' : 'Aplicar manual oficial'}
        </button>
        <button
          type="button"
          onClick={handleSaveServer}
          disabled={saving}
          className="btn-ui-primary px-4 py-2"
        >
          {saving ? 'Salvando...' : 'Salvar no servidor'}
        </button>
      </div>

      <p className="text-[11px] text-slate-600">As configurações são persistidas no servidor (banco) ao clicar em "Salvar no servidor".</p>
      {loading && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
          Carregando configurações da Sofia...
        </div>
      )}
    </div>
  );
};

export default SofiaSettings;

