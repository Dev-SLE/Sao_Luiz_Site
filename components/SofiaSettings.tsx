import React, { useCallback, useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { authClient } from '../lib/auth';

type SofiaAiActionsState = {
  manualSuggestReply: boolean;
  conversationSummary: boolean;
  autoReplyToCustomer: boolean;
  keywordHandoffAutoSend: boolean;
  classifyTopic: boolean;
  definePriority: boolean;
  suggestFunnelMove: boolean;
  autoUpdateTopic: boolean;
  runInboundClassification: boolean;
};

type FunnelSlaRow = { stageKey: string; blockAiAutoReply: boolean; maxMinutes: string };

interface SofiaSettingsState {
  name: string;
  aiProvider: 'OPENAI' | 'GEMINI';
  welcome: string;
  knowledgeBase: string;
  days: Record<string, boolean>;
  autoReplyEnabled: boolean;
  modelName: string;
  escalationKeywords: string;
  autoMode: 'ASSISTIDO' | 'SEMI_AUTO' | 'AUTO_TOTAL' | 'CLASSIFICACAO' | 'DESLIGADA';
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
  generateSummaryEnabled: boolean;
  defaultLanguage: string;
  replyOutsideBusinessHours: boolean;
  outsideHoursMessage: string;
  aiActionsAllowed: SofiaAiActionsState;
  funnelSlaRules: FunnelSlaRow[];
}

type SofiaSettingsTab = 'identidade' | 'operacao' | 'conhecimento' | 'modelo' | 'avancado' | 'logs';

function FieldHint({ text }: { text: string }) {
  return (
    <span className="inline-flex align-middle ml-0.5 text-slate-400 cursor-help" title={text}>
      <Info size={12} className="shrink-0" aria-label={text} />
    </span>
  );
}

/** Meta JSON só expande inline até este tamanho (evita DOM pesado). */
const AI_LOG_META_MAX_EXPAND = 480;

function stringifyLogMeta(meta: Record<string, unknown> | undefined | null): string {
  try {
    if (!meta || typeof meta !== 'object') return '';
    return JSON.stringify(meta);
  } catch {
    return '';
  }
}

const defaultState: SofiaSettingsState = {
  name: 'Sofia',
  aiProvider: 'OPENAI',
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
  defaultLanguage: 'pt-BR',
  replyOutsideBusinessHours: false,
  outsideHoursMessage: '',
  aiActionsAllowed: {
    manualSuggestReply: true,
    conversationSummary: true,
    autoReplyToCustomer: true,
    keywordHandoffAutoSend: true,
    classifyTopic: true,
    definePriority: true,
    suggestFunnelMove: true,
    autoUpdateTopic: false,
    runInboundClassification: false,
  },
  funnelSlaRules: [],
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
  generateSummaryEnabled: true,
};

type AiActionRow = {
  id: string;
  createdAt: string;
  source: string;
  taskType: string;
  provider: string;
  modelName: string | null;
  ok: boolean;
  httpStatus: number | null;
  errorLabel: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  conversationId: string | null;
  leadId: string | null;
  meta: Record<string, unknown>;
};

const SofiaSettings: React.FC = () => {
  const [state, setState] = useState<SofiaSettingsState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [aiSecretsStatus, setAiSecretsStatus] = useState<{ openai: string; gemini: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SofiaSettingsTab>('identidade');
  const [logRows, setLogRows] = useState<AiActionRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logOffset, setLogOffset] = useState(0);
  const [logHasMore, setLogHasMore] = useState(false);
  const logLimit = 50;
  const [testConversationId, setTestConversationId] = useState('');
  const [testText, setTestText] = useState('Olá, preciso do status do meu CTE.');
  const [testDryRun, setTestDryRun] = useState(true);
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);

  const loadLogs = useCallback(async (offset: number) => {
    setLogLoading(true);
    setLogError(null);
    try {
      const data = await authClient.getSofiaAiActions({ limit: logLimit, offset });
      const rows = (data?.rows || []) as AiActionRow[];
      setLogRows(rows);
      setLogHasMore(!!data?.hasMore);
      setLogOffset(offset);
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Falha ao carregar logs.');
      setLogRows([]);
    } finally {
      setLogLoading(false);
    }
  }, [logLimit]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const api = await authClient.getSofiaSettings().catch(() => null);
        if (api?.aiSecretsStatus) {
          setAiSecretsStatus(api.aiSecretsStatus as { openai: string; gemini: string });
        }
        if (api?.settings) {
          const s = api.settings;
          setState((prev) => ({
            ...prev,
            name: s.name || prev.name,
            aiProvider: (s.aiProvider || prev.aiProvider) as SofiaSettingsState['aiProvider'],
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
            generateSummaryEnabled:
              s.generateSummaryEnabled === undefined ? prev.generateSummaryEnabled : !!s.generateSummaryEnabled,
            defaultLanguage: s.defaultLanguage != null ? String(s.defaultLanguage) : prev.defaultLanguage,
            replyOutsideBusinessHours:
              s.replyOutsideBusinessHours === undefined ? prev.replyOutsideBusinessHours : !!s.replyOutsideBusinessHours,
            outsideHoursMessage: s.outsideHoursMessage != null ? String(s.outsideHoursMessage) : prev.outsideHoursMessage,
            aiActionsAllowed:
              s.aiActionsAllowed && typeof s.aiActionsAllowed === 'object'
                ? { ...prev.aiActionsAllowed, ...(s.aiActionsAllowed as Partial<SofiaAiActionsState>) }
                : prev.aiActionsAllowed,
            funnelSlaRules: Array.isArray(s.funnelSlaRules)
              ? (s.funnelSlaRules as { stageKey?: string; blockAiAutoReply?: boolean; maxMinutes?: number | null }[]).map(
                  (r) => ({
                    stageKey: String(r.stageKey || '').trim(),
                    blockAiAutoReply: !!r.blockAiAutoReply,
                    maxMinutes: r.maxMinutes != null && Number.isFinite(Number(r.maxMinutes)) ? String(r.maxMinutes) : '',
                  })
                )
              : prev.funnelSlaRules,
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

  useEffect(() => {
    if (activeTab === 'logs') {
      void loadLogs(0);
    }
  }, [activeTab, loadLogs]);

  const handleSaveServer = async () => {
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await authClient.saveSofiaSettings({
        name: state.name,
        aiProvider: state.aiProvider,
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
        generateSummaryEnabled: state.generateSummaryEnabled,
        defaultLanguage: state.defaultLanguage,
        replyOutsideBusinessHours: state.replyOutsideBusinessHours,
        outsideHoursMessage: state.outsideHoursMessage,
        aiActionsAllowed: state.aiActionsAllowed,
        funnelSlaRules: state.funnelSlaRules
          .map((r) => ({
            stageKey: r.stageKey.trim().toUpperCase(),
            blockAiAutoReply: r.blockAiAutoReply,
            maxMinutes: r.maxMinutes.trim() === '' ? null : Number(r.maxMinutes),
          }))
          .filter((r) => r.stageKey.length > 0),
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
      if (api?.aiSecretsStatus) {
        setAiSecretsStatus(api.aiSecretsStatus as { openai: string; gemini: string });
      }
      const s = api?.settings;
      if (s) {
        setState((prev) => ({
          ...prev,
          name: s.name || prev.name,
          aiProvider: (s.aiProvider || prev.aiProvider) as SofiaSettingsState['aiProvider'],
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
          generateSummaryEnabled:
            s.generateSummaryEnabled === undefined ? prev.generateSummaryEnabled : !!s.generateSummaryEnabled,
          defaultLanguage: s.defaultLanguage != null ? String(s.defaultLanguage) : prev.defaultLanguage,
          replyOutsideBusinessHours:
            s.replyOutsideBusinessHours === undefined ? prev.replyOutsideBusinessHours : !!s.replyOutsideBusinessHours,
          outsideHoursMessage: s.outsideHoursMessage != null ? String(s.outsideHoursMessage) : prev.outsideHoursMessage,
          aiActionsAllowed:
            s.aiActionsAllowed && typeof s.aiActionsAllowed === 'object'
              ? { ...prev.aiActionsAllowed, ...(s.aiActionsAllowed as Partial<SofiaAiActionsState>) }
              : prev.aiActionsAllowed,
          funnelSlaRules: Array.isArray(s.funnelSlaRules)
            ? (s.funnelSlaRules as { stageKey?: string; blockAiAutoReply?: boolean; maxMinutes?: number | null }[]).map(
                (r) => ({
                  stageKey: String(r.stageKey || '').trim(),
                  blockAiAutoReply: !!r.blockAiAutoReply,
                  maxMinutes: r.maxMinutes != null && Number.isFinite(Number(r.maxMinutes)) ? String(r.maxMinutes) : '',
                })
              )
            : prev.funnelSlaRules,
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

  const setAiAllowed = (key: keyof SofiaAiActionsState, value: boolean) => {
    setState((prev) => ({
      ...prev,
      aiActionsAllowed: { ...prev.aiActionsAllowed, [key]: value },
    }));
  };

  const runSofiaTest = async () => {
    if (!testConversationId.trim()) {
      setTestOutput('Indique o UUID da conversa.');
      return;
    }
    setTestRunning(true);
    setTestOutput(null);
    try {
      const data = await authClient.getSofiaReplySuggestion({
        conversationId: testConversationId.trim(),
        text: testText,
        manualSofiaAction: true,
        dryRun: testDryRun,
      });
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (e) {
      setTestOutput(e instanceof Error ? e.message : 'Erro ao chamar /crm/sofia/respond');
    } finally {
      setTestRunning(false);
    }
  };

  const tabDefs: { id: SofiaSettingsTab; label: string }[] = [
    { id: 'identidade', label: 'Identidade' },
    { id: 'operacao', label: 'Operação' },
    { id: 'conhecimento', label: 'Conhecimento' },
    { id: 'modelo', label: 'Modelo e IA' },
    { id: 'avancado', label: 'Avançado' },
    { id: 'logs', label: 'Logs de IA' },
  ];

  const panelClass =
    'space-y-3 rounded-xl border border-sl-navy/20 bg-gradient-to-b from-white to-slate-50 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-slate-900">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-sl-red border border-slate-200 shadow-[0_0_18px_rgba(236,27,35,0.4)]">
          <span className="text-sm font-black">IA</span>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Configurações da Sofia</h1>
          <p className="text-xs text-slate-600">
            Abas alinhadas ao guia interno: identidade, operação, conhecimento, modelo e auditoria de chamadas à IA.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-px" aria-label="Secções Sofia">
        {tabDefs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-3 py-2 text-xs font-semibold transition-colors rounded-t-md border border-b-0 ${
              activeTab === t.id
                ? 'border-slate-200 bg-white text-sl-navy relative z-[1] mb-[-1px] shadow-[0_-2px_0_0_white]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

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

      {activeTab === 'identidade' && (
        <div className={panelClass}>
          <h2 className="mb-1 text-sm font-bold text-slate-900">Identidade</h2>
          <div className="space-y-3">
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Nome da assistente
                <FieldHint text="Nome exibido nas mensagens enviadas como IA no WhatsApp." />
              </label>
              <input
                className="field-ui mt-1 w-full"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Mensagem de boas-vindas
                <FieldHint text="Quando ativa, pode ser combinada ao primeiro envio automático conforme regras do canal." />
              </label>
              <select
                className="field-ui mb-2 mt-1 w-full"
                value={state.welcomeEnabled ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, welcomeEnabled: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Boas-vindas ativas</option>
                <option value="NAO">Boas-vindas desativadas</option>
              </select>
              <textarea
                className="field-ui min-h-[88px] w-full resize-none"
                value={state.welcome}
                onChange={(e) => setState((s) => ({ ...s, welcome: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="text-ui-label inline-flex items-center gap-0.5">
                  Tom de resposta
                  <FieldHint text="Estilo padrão usado na geração de texto (profissional, empático ou direto)." />
                </label>
                <select
                  className="field-ui w-full mt-1"
                  value={state.responseTone}
                  onChange={(e) => setState((s) => ({ ...s, responseTone: e.target.value as SofiaSettingsState['responseTone'] }))}
                >
                  <option value="PROFISSIONAL">Profissional</option>
                  <option value="EMPATICO">Empático</option>
                  <option value="DIRETO">Direto</option>
                </select>
              </div>
              <div>
                <label className="text-ui-label inline-flex items-center gap-0.5">
                  Idioma (prompt)
                  <FieldHint text="Persistido no servidor; altera a instrução de idioma enviada ao modelo (pt-BR, en, es)." />
                </label>
                <select
                  className="field-ui w-full mt-1"
                  value={state.defaultLanguage}
                  onChange={(e) => setState((s) => ({ ...s, defaultLanguage: e.target.value }))}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Máx. caracteres por resposta
                <FieldHint text="Limita o tamanho das respostas sugeridas ou automáticas no WhatsApp." />
              </label>
              <input
                type="number"
                className="field-ui w-full mt-1"
                value={state.maxResponseChars}
                onChange={(e) => setState((s) => ({ ...s, maxResponseChars: Number(e.target.value) || 480 }))}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'operacao' && (
        <div className={panelClass}>
          <h2 className="mb-1 text-sm font-bold text-slate-900">Operação</h2>
          <p className="mb-2 text-[11px] text-slate-600">
            Dias em que a Sofia pode atuar sozinha (respeitando também horário e governança no servidor).
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
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
                    : 'px-3 py-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:border-sl-navy/45'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-ui-label">Início do atendimento</label>
                <input
                  type="time"
                  className="field-ui w-full mt-1"
                  value={state.businessHoursStart}
                  onChange={(e) => setState((s) => ({ ...s, businessHoursStart: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-ui-label">Fim do atendimento</label>
                <input
                  type="time"
                  className="field-ui w-full mt-1"
                  value={state.businessHoursEnd}
                  onChange={(e) => setState((s) => ({ ...s, businessHoursEnd: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Resposta automática (Sofia ativa)
                <FieldHint text="Se Não, a Sofia não envia mensagens sozinhas; sugestões no chat ainda podem ser pedidas manualmente." />
              </label>
              <select
                className="field-ui w-full mt-1"
                value={state.autoReplyEnabled ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, autoReplyEnabled: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Modo de operação
                <FieldHint text="Assistido: só sugestão. Semi-auto: confirmação. Auto total: envio automático se permitido. Classificação: sem resposta IA em segundo plano no CRM. Desligada: bloqueia resumo automático e gatilhos em background (botões manuais continuam)." />
              </label>
              <select
                className="field-ui w-full mt-1"
                value={state.autoMode}
                onChange={(e) => setState((s) => ({ ...s, autoMode: e.target.value as SofiaSettingsState['autoMode'] }))}
              >
                <option value="ASSISTIDO">Assistido (só sugestão)</option>
                <option value="SEMI_AUTO">Semi-auto (humano confirma)</option>
                <option value="AUTO_TOTAL">Auto total (com governança)</option>
                <option value="CLASSIFICACAO">Só classificação (sem IA de resposta em background)</option>
                <option value="DESLIGADA">Desligada (sem automático em background)</option>
              </select>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Responder fora do horário comercial
                <FieldHint text="Se Sim, a janela de horário deixa de bloquear sozinha o envio automático (WhatsApp auto total e governança no servidor)." />
              </label>
              <select
                className="field-ui w-full mt-1"
                value={state.replyOutsideBusinessHours ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, replyOutsideBusinessHours: e.target.value === 'SIM' }))}
              >
                <option value="NAO">Não (respeitar início/fim)</option>
                <option value="SIM">Sim (permitir fora do horário)</option>
              </select>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Mensagem fora do horário
                <FieldHint text="Quando o envio automático é bloqueado por horário, esta mensagem substitui a de handoff se estiver preenchida." />
              </label>
              <textarea
                className="field-ui min-h-[70px] w-full resize-y mt-1"
                value={state.outsideHoursMessage}
                onChange={(e) => setState((s) => ({ ...s, outsideHoursMessage: e.target.value }))}
                placeholder="Ex.: Nosso horário de atendimento é… Voltamos em breve."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="text-ui-label inline-flex items-center gap-0.5">
                  Confiança mínima (%)
                  <FieldHint text="Abaixo deste valor, o backend não autoriza envio automático ao cliente." />
                </label>
                <input
                  type="number"
                  className="field-ui w-full mt-1"
                  value={state.minConfidence}
                  onChange={(e) => setState((s) => ({ ...s, minConfidence: Number(e.target.value) || 70 }))}
                />
              </div>
              <div>
                <label className="text-ui-label inline-flex items-center gap-0.5">
                  Máx. respostas automáticas por conversa
                  <FieldHint text="Após este número de mensagens IA na conversa, o autoenvio é bloqueado até intervenção humana." />
                </label>
                <input
                  type="number"
                  className="field-ui w-full mt-1"
                  value={state.maxAutoRepliesPerConversation}
                  onChange={(e) => setState((s) => ({ ...s, maxAutoRepliesPerConversation: Number(e.target.value) || 2 }))}
                />
              </div>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Escalar após X mensagens do cliente (em sequência)
                <FieldHint text="Contagem de mensagens do cliente sem resposta humana/IA na ordem do histórico." />
              </label>
              <input
                type="number"
                className="field-ui w-full mt-1"
                value={state.requireHumanAfterCustomerMessages}
                onChange={(e) =>
                  setState((s) => ({ ...s, requireHumanAfterCustomerMessages: Number(e.target.value) || 4 }))
                }
              />
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Escalar quando SLA estourar
                <FieldHint text="Quando ativo, conversa com SLA vencido não recebe auto-resposta da Sofia." />
              </label>
              <select
                className="field-ui w-full mt-1"
                value={state.requireHumanIfSlaBreached ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, requireHumanIfSlaBreached: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>
            <div>
              <label className="text-ui-label inline-flex items-center gap-0.5">
                Gerar resumo da conversa
                <FieldHint text="Ao abrir o chat, pode pedir um resumo curto para contexto (chama a IA se configurada)." />
              </label>
              <select
                className="field-ui w-full mt-1"
                value={state.generateSummaryEnabled ? 'SIM' : 'NAO'}
                onChange={(e) => setState((s) => ({ ...s, generateSummaryEnabled: e.target.value === 'SIM' }))}
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conhecimento' && (
        <div className={panelClass}>
          <h2 className="mb-1 text-sm font-bold text-slate-900">Conhecimento e políticas</h2>
          <p className="mb-2 text-[11px] text-slate-600">
            Base principal, palavras sensíveis (escalação), bloqueios e mensagens de fallback/handoff.
          </p>
          <textarea
            className="field-ui min-h-[180px] w-full resize-y"
            value={state.knowledgeBase}
            onChange={(e) => setState((s) => ({ ...s, knowledgeBase: e.target.value }))}
            placeholder="Regras de negócio, prazos, tipos de carga…"
          />
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5 mt-2">
              Palavras sensíveis (escalação)
              <FieldHint text="Se a mensagem do cliente contiver uma destas palavras, o fluxo pode forçar handoff (ver backend)." />
            </label>
            <input
              className="field-ui w-full mt-1"
              value={state.escalationKeywords}
              onChange={(e) => setState((s) => ({ ...s, escalationKeywords: e.target.value }))}
              placeholder="Separadas por vírgula"
            />
          </div>
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5">
              Temas bloqueados para auto
              <FieldHint text="Tópicos da conversa em que a Sofia não deve enviar resposta automática." />
            </label>
            <input
              className="field-ui w-full mt-1"
              value={state.blockedTopics}
              onChange={(e) => setState((s) => ({ ...s, blockedTopics: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5">
              Status bloqueados para auto
              <FieldHint text="Estados do funil em que a auto-resposta é bloqueada." />
            </label>
            <input
              className="field-ui w-full mt-1"
              value={state.blockedStatuses}
              onChange={(e) => setState((s) => ({ ...s, blockedStatuses: e.target.value }))}
            />
          </div>
          <p className="text-[11px] text-slate-600">
            Dica: mantenha <strong>AGUARDANDO_RETORNO_AGENCIA</strong> bloqueado para fluxos que dependem da agência.
          </p>
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5">
              Instruções do supervisor (prompt base)
              <FieldHint text="Regras fixas de compliance e conduta injetadas no contexto da IA." />
            </label>
            <textarea
              className="field-ui min-h-[100px] w-full resize-y mt-1"
              value={state.systemInstructions}
              onChange={(e) => setState((s) => ({ ...s, systemInstructions: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5">
              Mensagem de fallback
              <FieldHint text="Usada quando a API de IA falha ou devolve vazio; não substitui revisão humana." />
            </label>
            <textarea
              className="field-ui min-h-[70px] w-full resize-y mt-1"
              value={state.fallbackMessage}
              onChange={(e) => setState((s) => ({ ...s, fallbackMessage: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5">
              Mensagem de handoff
              <FieldHint text="Texto sugerido quando a governança bloqueia envio automático ou em escalação." />
            </label>
            <textarea
              className="field-ui min-h-[70px] w-full resize-y mt-1"
              value={state.handoffMessage}
              onChange={(e) => setState((s) => ({ ...s, handoffMessage: e.target.value }))}
            />
          </div>
        </div>
      )}

      {activeTab === 'modelo' && (
        <div className={panelClass}>
          <h2 className="mb-1 text-sm font-bold text-slate-900">Modelo e provedor</h2>
          <p className="text-[11px] text-slate-600 mb-2">
            Chaves de API ficam apenas no servidor (variáveis de ambiente), por segurança.
          </p>
          {aiSecretsStatus ? (
            <p className="text-[11px] text-slate-700 rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5 mb-3">
              Chaves no servidor (somente leitura): OpenAI{' '}
              {aiSecretsStatus.openai === 'configured' ? 'configurada' : 'ausente'} · Gemini{' '}
              {aiSecretsStatus.gemini === 'configured' ? 'configurada' : 'ausente'}.
            </p>
          ) : null}
          <div>
            <label className="text-ui-label inline-flex items-center gap-0.5">
              Provedor
              <FieldHint text="Ordem de fallback entre provedores é definida no backend conforme AI_PROVIDER." />
            </label>
            <select
              className="field-ui w-full mt-1"
              value={state.aiProvider}
              onChange={(e) => setState((s) => ({ ...s, aiProvider: e.target.value as SofiaSettingsState['aiProvider'] }))}
            >
              <option value="OPENAI">OpenAI</option>
              <option value="GEMINI">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="text-ui-label">Modelo</label>
            <select
              className="field-ui w-full mt-1"
              value={state.modelName}
              onChange={(e) => setState((s) => ({ ...s, modelName: e.target.value }))}
            >
              {state.aiProvider === 'GEMINI' ? (
                <>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (rápido e econômico)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (mais preciso)</option>
                </>
              ) : (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini (rápido e econômico)</option>
                  <option value="gpt-4.1">gpt-4.1 (mais preciso)</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini (equilibrado)</option>
                </>
              )}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'avancado' && (
        <div className={panelClass}>
          <h2 className="mb-1 text-sm font-bold text-slate-900">Avançado</h2>
          <p className="text-[11px] text-slate-600 mb-3">
            Ações permitidas, regras de funil e teste da API de resposta. Documentação extra:{' '}
            <code className="bg-slate-100 px-1 rounded text-[11px]">docs/contexto-agente/README.md</code>
          </p>

          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">Ações permitidas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {(
              [
                ['manualSuggestReply', 'Sugestão manual no CRM', 'Botão “Sugerir resposta” e pedidos explícitos.'],
                ['conversationSummary', 'Resumo automático ao abrir', 'Resumo ao carregar conversa (sem clique).'],
                ['autoReplyToCustomer', 'Resposta automática ao cliente', 'WhatsApp auto total e envio automático no CRM.'],
                ['keywordHandoffAutoSend', 'Enviar handoff por palavra-chave', 'Se desligado, o CRM não envia sozinho a mensagem de handoff.'],
                ['classifyTopic', 'Classificar tema', 'Gera classificação de tema via IA quando em modo classificação.'],
                ['definePriority', 'Definir prioridade', 'Permite que a IA devolva prioridade sugerida no resultado estruturado.'],
                ['suggestFunnelMove', 'Sugerir movimentação no funil', 'Permite incluir `suggestedStage` na classificação.'],
                ['autoUpdateTopic', 'Atualizar tema automaticamente', 'Quando ativo, a classificação pode persistir tópico na conversa.'],
                ['runInboundClassification', 'Classificar mensagens recebidas (WhatsApp)', 'Habilita classificação inbound em modo CLASSIFICACAO sem resposta ao cliente.'],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={state.aiActionsAllowed[key]}
                  onChange={(e) => setAiAllowed(key, e.target.checked)}
                />
                <span>
                  <span className="font-semibold text-slate-800">{label}</span>
                  <span className="block text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 mt-5">Funil / SLA por etapa</h3>
          <p className="text-[11px] text-slate-600 mb-2">
            Use o mesmo código de status da conversa (ex.: PENDENTE). “Bloquear IA auto” impede envio automático nessa
            etapa (CRM e WhatsApp auto total). “Min” bloqueia auto quando a conversa excede o tempo da etapa.
          </p>
          <div className="space-y-2">
            {state.funnelSlaRules.map((row, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <div className="min-w-[120px] flex-1">
                  <label className="text-[10px] font-semibold text-slate-600">Status (conversa)</label>
                  <input
                    className="field-ui w-full mt-0.5 text-xs"
                    value={row.stageKey}
                    onChange={(e) =>
                      setState((s) => {
                        const next = [...s.funnelSlaRules];
                        next[idx] = { ...next[idx], stageKey: e.target.value };
                        return { ...s, funnelSlaRules: next };
                      })
                    }
                    placeholder="PENDENTE"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 pb-1">
                  <input
                    type="checkbox"
                    checked={row.blockAiAutoReply}
                    onChange={(e) =>
                      setState((s) => {
                        const next = [...s.funnelSlaRules];
                        next[idx] = { ...next[idx], blockAiAutoReply: e.target.checked };
                        return { ...s, funnelSlaRules: next };
                      })
                    }
                  />
                  Bloquear IA auto
                </label>
                <div className="w-24">
                  <label className="text-[10px] font-semibold text-slate-600">Min (opc.)</label>
                  <input
                    type="number"
                    className="field-ui w-full mt-0.5 text-xs"
                    value={row.maxMinutes}
                    onChange={(e) =>
                      setState((s) => {
                        const next = [...s.funnelSlaRules];
                        next[idx] = { ...next[idx], maxMinutes: e.target.value };
                        return { ...s, funnelSlaRules: next };
                      })
                    }
                    placeholder="—"
                  />
                </div>
                <button
                  type="button"
                  className="btn-ui-secondary px-2 py-1 text-[11px]"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      funnelSlaRules: s.funnelSlaRules.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-ui-secondary px-3 py-1.5 text-xs"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  funnelSlaRules: [...s.funnelSlaRules, { stageKey: '', blockAiAutoReply: true, maxMinutes: '' }],
                }))
              }
            >
              Adicionar regra
            </button>
          </div>

          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 mt-5">Testar Sofia</h3>
          <p className="text-[11px] text-slate-600 mb-2">
            Chama <code className="bg-slate-100 px-1 rounded">POST /crm/sofia/respond</code> com permissão de CRM. Em
            dry-run, handoff por palavra-chave não grava alterações na base.
          </p>
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ui-secondary px-2 py-1 text-[11px]"
                onClick={() =>
                  setTestText('Olá, preciso rastrear o CTE 123456 e saber o prazo de entrega para Goiânia.')
                }
              >
                Exemplo rastreio
              </button>
              <button
                type="button"
                className="btn-ui-secondary px-2 py-1 text-[11px]"
                onClick={() =>
                  setTestText('Minha carga chegou avariada e quero abrir uma ocorrência urgente.')
                }
              >
                Exemplo ocorrência
              </button>
            </div>
            <div>
              <label className="text-ui-label">ID da conversa (UUID)</label>
              <input
                className="field-ui w-full mt-1 font-mono text-xs"
                value={testConversationId}
                onChange={(e) => setTestConversationId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div>
              <label className="text-ui-label">Texto do cliente (contexto)</label>
              <textarea
                className="field-ui min-h-[80px] w-full resize-y mt-1 text-xs"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={testDryRun} onChange={(e) => setTestDryRun(e.target.checked)} />
              Dry-run (sem persistir handoff por palavra-chave)
            </label>
            <button
              type="button"
              className="btn-ui-primary px-3 py-2 text-xs"
              disabled={testRunning}
              onClick={() => void runSofiaTest()}
            >
              {testRunning ? 'A executar…' : 'Executar teste'}
            </button>
            {testOutput ? (
              <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-900 text-emerald-100 p-3 text-[10px] leading-snug font-mono whitespace-pre-wrap break-all">
                {testOutput}
              </pre>
            ) : null}
            <p className="text-[11px] text-slate-600">
              Dica: em modo <strong>CLASSIFICACAO</strong>, a resposta retorna campo <code>classification</code> com tema,
              prioridade e resumo estruturado.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className={panelClass}>
          <h2 className="mb-1 text-sm font-bold text-slate-900">Logs de chamadas à IA</h2>
          <p className="text-[11px] text-slate-600 mb-2">
            Registos em <code className="bg-slate-100 px-1 rounded">crm_sofia_ai_actions_log</code> (tokens, latência,
            erros HTTP). Sem texto do cliente. Meta só abre inline se o JSON tiver até {AI_LOG_META_MAX_EXPAND}{' '}
            caracteres.
          </p>
          {logError && <p className="text-xs text-red-700 mb-2">{logError}</p>}
          {logLoading ? (
            <p className="text-xs text-slate-600">A carregar…</p>
          ) : logRows.length === 0 ? (
            <p className="text-xs text-slate-600">Sem registos ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-[10px] text-left">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Quando</th>
                    <th className="px-2 py-1.5 font-semibold">Origem</th>
                    <th className="px-2 py-1.5 font-semibold">Tarefa</th>
                    <th className="px-2 py-1.5 font-semibold">Modelo</th>
                    <th className="px-2 py-1.5 font-semibold">OK</th>
                    <th className="px-2 py-1.5 font-semibold">HTTP</th>
                    <th className="px-2 py-1.5 font-semibold">ms</th>
                    <th className="px-2 py-1.5 font-semibold">Conv.</th>
                    <th className="px-2 py-1.5 font-semibold">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.map((r) => {
                    const metaStr = stringifyLogMeta(r.meta);
                    const metaLen = metaStr.length;
                    const canExpand = metaLen > 0 && metaLen <= AI_LOG_META_MAX_EXPAND;
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80 align-top">
                        <td className="px-2 py-1 whitespace-nowrap">
                          {r.createdAt ? new Date(String(r.createdAt)).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-2 py-1">{r.source}</td>
                        <td className="px-2 py-1">{r.taskType}</td>
                        <td className="px-2 py-1">{r.modelName || r.provider}</td>
                        <td className="px-2 py-1">{r.ok ? 'sim' : 'não'}</td>
                        <td className="px-2 py-1">{r.httpStatus ?? '—'}</td>
                        <td className="px-2 py-1">{r.latencyMs ?? '—'}</td>
                        <td className="px-2 py-1 font-mono max-w-[72px] truncate" title={r.conversationId || ''}>
                          {r.conversationId ? `${r.conversationId.slice(0, 8)}…` : '—'}
                        </td>
                        <td className="px-2 py-1 max-w-[140px]">
                          {metaLen === 0 ? (
                            '—'
                          ) : canExpand ? (
                            <details className="text-[10px] text-slate-700">
                              <summary className="cursor-pointer font-semibold text-sl-navy hover:underline">
                                Ver meta
                              </summary>
                              <pre className="mt-1 max-h-36 overflow-auto rounded border border-slate-200 bg-white p-2 text-[9px] leading-snug font-mono whitespace-pre-wrap break-all">
                                {metaStr}
                              </pre>
                            </details>
                          ) : (
                            <span
                              className="text-slate-500"
                              title="Meta demasiado grande para expandir aqui; consultar no banco se necessário."
                            >
                              {metaLen} chars
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!logLoading && logRows.length > 0 && (
            <div className="flex items-center justify-between gap-2 mt-2">
              <button
                type="button"
                className="btn-ui-secondary px-3 py-1.5 text-xs"
                disabled={logOffset <= 0}
                onClick={() => void loadLogs(Math.max(0, logOffset - logLimit))}
              >
                Anterior
              </button>
              <span className="text-[11px] text-slate-600">
                Offset {logOffset}
                {logHasMore ? ' · há mais' : ''}
              </span>
              <button
                type="button"
                className="btn-ui-secondary px-3 py-1.5 text-xs"
                disabled={!logHasMore}
                onClick={() => void loadLogs(logOffset + logLimit)}
              >
                Seguinte
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab !== 'logs' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={applyOfficialTemplate}
            disabled={saving}
            className="btn-ui-secondary mr-2 px-4 py-2"
          >
            {saving ? 'Aplicando...' : 'Aplicar manual oficial'}
          </button>
          <button type="button" onClick={handleSaveServer} disabled={saving} className="btn-ui-primary px-4 py-2">
            {saving ? 'Salvando...' : 'Salvar no servidor'}
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-600">
        As configurações guardam-se no servidor ao clicar em &quot;Salvar no servidor&quot; (exceto na aba de logs,
        só leitura).
      </p>
      {loading && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
          Carregando configurações da Sofia...
        </div>
      )}
    </div>
  );
};

export default SofiaSettings;
