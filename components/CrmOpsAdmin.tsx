import React, { useEffect, useState } from "react";
import { authClient } from "../lib/auth";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { EvolutionInboxPairModal, type PairInboxInfo } from "./EvolutionInboxPairModal";
import { AppMessageModal, type AppMessageVariant } from "./AppOverlays";
import { useAuth } from "../context/AuthContext";

const CrmOpsAdmin: React.FC = () => {
  const { user } = useAuth();
  const [cadences, setCadences] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [crmStages, setCrmStages] = useState<Array<{ id: string; name: string }>>([]);
  const [cadenceForm, setCadenceForm] = useState({
    id: "",
    name: "",
    messageTemplate: "",
    triggerAfterMinutes: 1440,
    stageId: "",
    isActive: true,
  });
  const [campaignForm, setCampaignForm] = useState({
    id: "",
    name: "",
    messageTemplate: "",
    requireOptIn: true,
    status: "DRAFT",
    audienceStageId: "",
    audiencePriority: "",
    audienceLimit: 100,
  });
  const [queueLimit, setQueueLimit] = useState(80);
  const [teams, setTeams] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [slaRules, setSlaRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [teamForm, setTeamForm] = useState({ id: "", name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ teamId: "", username: "", memberRole: "ATENDENTE" });
  const [ruleForm, setRuleForm] = useState({
    id: "",
    name: "",
    priority: 100,
    matchType: "TOPIC",
    matchValue: "",
    targetType: "USER",
    targetUsername: "",
    targetTeamId: "",
    targetStageId: "",
  });
  const [slaForm, setSlaForm] = useState({
    teamId: "",
    topic: "",
    channel: "WHATSAPP",
    priority: "MEDIA",
    slaMinutes: 30,
  });
  const [waInboxes, setWaInboxes] = useState<any[]>([]);
  const [evoForm, setEvoForm] = useState({
    id: "",
    name: "",
    evolutionInstanceName: "",
    evolutionServerUrl: "",
    evolutionApiKey: "",
    teamId: "",
    ownerUsername: "",
  });
  const [webhookHint, setWebhookHint] = useState("");
  const [provisionEvolutionInstance, setProvisionEvolutionInstance] = useState(true);
  const [pairInbox, setPairInbox] = useState<PairInboxInfo | null>(null);
  const [evolutionDefaultsConfigured, setEvolutionDefaultsConfigured] = useState(false);
  const [evoAdvancedOpen, setEvoAdvancedOpen] = useState(false);
  const [opsNotice, setOpsNotice] = useState<{
    title: string;
    message: string;
    variant: AppMessageVariant;
  } | null>(null);
  const [intakeSettings, setIntakeSettings] = useState({
    leadFilterMode: "BUSINESS_ONLY",
    aiEnabled: true,
    minMessagesBeforeCreate: 2,
    metaLeadFilterMode: "BUSINESS_ONLY",
    metaAiEnabled: true,
    metaMinMessagesBeforeCreate: 1,
    allowlistLast10: "",
    denylistLast10: "",
  });
  const [pendingIntakeCount, setPendingIntakeCount] = useState(0);
  const [intakeBufferItems, setIntakeBufferItems] = useState<any[]>([]);

  const normalizeLast10 = (raw: unknown): string => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.length <= 10 ? digits : digits.slice(-10);
  };

  const mergeLast10List = (current: string, incoming: string[]) => {
    const set = new Set<string>();
    String(current || "")
      .split(",")
      .map((x) => normalizeLast10(x))
      .filter(Boolean)
      .forEach((n) => set.add(n));
    incoming.map((x) => normalizeLast10(x)).filter(Boolean).forEach((n) => set.add(n));
    return Array.from(set).join(", ");
  };

  const extractNumbersFromRows = (rows: any[]): string[] => {
    const out: string[] = [];
    for (const row of rows || []) {
      if (row == null) continue;
      if (typeof row === "string" || typeof row === "number") {
        const n = normalizeLast10(row);
        if (n) out.push(n);
        continue;
      }
      if (Array.isArray(row)) {
        for (const cell of row) {
          const n = normalizeLast10(cell);
          if (n) {
            out.push(n);
            break;
          }
        }
        continue;
      }
      const candidates = [
        row.last10,
        row.ultimo10,
        row.numero,
        row.number,
        row.telefone,
        row.phone,
      ];
      let picked = "";
      for (const c of candidates) {
        const n = normalizeLast10(c);
        if (n) {
          picked = n;
          break;
        }
      }
      if (!picked) {
        for (const v of Object.values(row)) {
          const n = normalizeLast10(v);
          if (n) {
            picked = n;
            break;
          }
        }
      }
      if (picked) out.push(picked);
    }
    return out;
  };

  const importListFile = async (file: File, target: "ALLOW" | "DENY") => {
    const name = file.name.toLowerCase();
    let numbers: string[] = [];
    if (name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      numbers = extractNumbersFromRows((parsed.data as any[]) || []);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      numbers = extractNumbersFromRows(json as any[]);
    } else {
      setOpsNotice({
        title: "Importação",
        message: "Formato não suportado. Use arquivos CSV, XLSX ou XLS.",
        variant: "warning",
      });
      return;
    }
    if (!numbers.length) {
      setOpsNotice({
        title: "Importação",
        message: "Nenhum número válido (últimos 10 dígitos) foi encontrado no arquivo.",
        variant: "warning",
      });
      return;
    }
    setIntakeSettings((s) => {
      if (target === "ALLOW") {
        return {
          ...s,
          allowlistLast10: mergeLast10List(s.allowlistLast10, numbers),
        };
      }
      return {
        ...s,
        denylistLast10: mergeLast10List(s.denylistLast10, numbers),
      };
    });
    setOpsNotice({
      title: "Importação concluída",
      message: `${numbers.length} número(s) mesclado(s) na ${target === "ALLOW" ? "allowlist" : "denylist"}. Lembre-se de salvar as configurações de triagem.`,
      variant: "success",
    });
  };

  const downloadTemplateCsv = () => {
    const sample = [
      ["numero", "last10", "nome", "tipo"],
      ["+55 62 99999-1111", "2999991111", "Agencia Exemplo", "ALLOW"],
      ["+55 11 98888-2222", "1988882222", "Contato Pessoal", "DENY"],
    ];
    const csv = sample.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_triagem_whatsapp.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplateXlsx = () => {
    const rows = [
      { numero: "+55 62 99999-1111", last10: "2999991111", nome: "Agencia Exemplo", tipo: "ALLOW" },
      { numero: "+55 11 98888-2222", last10: "1988882222", nome: "Contato Pessoal", tipo: "DENY" },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "triagem");
    XLSX.writeFile(wb, "template_triagem_whatsapp.xlsx");
  };

  const loadAll = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [t, a, r, w, intake, intakeBuffer, auto, board] = await Promise.all([
        authClient.getCrmTeams(),
        authClient.getCrmAgents(),
        authClient.getCrmRoutingRules(),
        authClient.getCrmWhatsappInboxes().catch(() => ({ inboxes: [], evolutionDefaultsConfigured: false })),
        authClient.getCrmEvolutionIntakeSettings().catch(() => ({ settings: null, pendingBufferCount: 0 })),
        authClient.getCrmEvolutionIntakeBuffer({ limit: 40 }).catch(() => ({ items: [] })),
        authClient.getCrmAutomation().catch(() => ({ cadences: [], campaigns: [] })),
        authClient
          .getCrmBoard({
            requestUsername: user?.username || "",
            requestRole: user?.role || "",
          })
          .catch(() => ({ stages: [] as any[] })),
      ]);
      const s = await authClient.getCrmSlaRules();
      setCadences(Array.isArray(auto?.cadences) ? auto.cadences : []);
      setCampaigns(Array.isArray(auto?.campaigns) ? auto.campaigns : []);
      setCrmStages(
        Array.isArray(board?.stages)
          ? board.stages.map((st: any) => ({ id: String(st.id), name: String(st.name || "") }))
          : []
      );
      setTeams(Array.isArray(t?.teams) ? t.teams : []);
      setAgents(Array.isArray(a?.agents) ? a.agents : []);
      setRules(Array.isArray(r?.rules) ? r.rules : []);
      setSlaRules(Array.isArray(s?.items) ? s.items : []);
      setEvolutionDefaultsConfigured(Boolean((w as any)?.evolutionDefaultsConfigured));
      setWaInboxes(Array.isArray(w?.inboxes) ? w.inboxes : []);
      if (intake?.settings) {
        setIntakeSettings({
          leadFilterMode: String(intake.settings.leadFilterMode || "BUSINESS_ONLY"),
          aiEnabled: intake.settings.aiEnabled !== false,
          minMessagesBeforeCreate: Number(intake.settings.minMessagesBeforeCreate || 2),
          metaLeadFilterMode: String(intake.settings.metaLeadFilterMode || "BUSINESS_ONLY"),
          metaAiEnabled: intake.settings.metaAiEnabled !== false,
          metaMinMessagesBeforeCreate: Number(intake.settings.metaMinMessagesBeforeCreate || 1),
          allowlistLast10: String(intake.settings.allowlistLast10 || ""),
          denylistLast10: String(intake.settings.denylistLast10 || ""),
        });
      }
      setPendingIntakeCount(Number(intake?.pendingBufferCount || 0));
      setIntakeBufferItems(Array.isArray(intakeBuffer?.items) ? intakeBuffer.items : []);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Falha ao carregar operação CRM.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user?.username, user?.role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const base = window.location.origin;
    setWebhookHint(`${base}/api/whatsapp/evolution/webhook`);
  }, []);

  return (
    <>
    <AppMessageModal
      open={!!opsNotice}
      title={opsNotice?.title || ""}
      message={opsNotice?.message || ""}
      variant={opsNotice?.variant || "info"}
      onClose={() => setOpsNotice(null)}
    />
    <EvolutionInboxPairModal open={Boolean(pairInbox)} onClose={() => setPairInbox(null)} inbox={pairInbox} />
    <div className="space-y-4">
      <div className="surface-card-strong p-4 border border-[#2c348c]/25 bg-gradient-to-br from-[#f8faff] to-white">
        <h3 className="text-sm font-black text-[#06183e]">Multiatendimento (estilo Kommo)</h3>
        <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700 list-disc pl-4 leading-relaxed">
          <li>
            <strong>Atendentes são usuários da plataforma</strong> (login e senha em{' '}
            <span className="font-semibold text-[#2c348c]">Configurações → Gestão de Usuários</span>). Crie um perfil com{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">VIEW_CRM_CHAT</code>,{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">VIEW_CRM_FUNIL</code> e escopo{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">CRM_SCOPE_SELF</code> (só o que é dele + fila) ou{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">CRM_SCOPE_TEAM</code> /{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">CRM_SCOPE_ALL</code>.
          </li>
          <li>
            <strong>Dois canais:</strong> a <strong>linha oficial (Meta / Cloud API)</strong> fica com a <strong>Sofia</strong> (webhook já existente). As{' '}
            <strong>linhas das atendentes</strong> (WhatsApp pessoal/comercial com app no celular + Web) usam{' '}
            <strong>Evolution API</strong> (open-source, gratuita — você hospeda no Docker/Railway/etc.) — cadastre cada instância em{' '}
            <strong>Caixas WhatsApp Web</strong> abaixo e aponte o webhook para este site.
          </li>
          <li>
            Monte <strong>times</strong>, coloque <strong>membros</strong> (usuários cadastrados) e <strong>regras de roteamento</strong> (tópico, palavra-chave → usuário ou time). Mensagens novas podem cair na fila sem responsável para alguém assumir.
          </li>
          <li>
            No <strong>Chat CRM</strong>: troque o responsável no select, use <strong>Assumir conversa</strong> ou{' '}
            <strong>Devolver à fila</strong> para liberar para outro atendente.
          </li>
        </ul>
      </div>

      <div className="surface-card-strong p-4 border border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
        <h3 className="text-sm font-bold text-slate-900">Cadências e campanhas (automação)</h3>
        <p className="mt-1 text-[11px] text-slate-600">
          Cadências disparam mensagem após tempo no estágio. Campanhas enfileiram template no WhatsApp para leads que
          atendem ao filtro (respeitando opt-in quando marcado). Texto da campanha vai para o outbox como mensagem
          simples.
        </p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-800">Cadência</h4>
            <input
              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
              placeholder="Nome"
              value={cadenceForm.name}
              onChange={(e) => setCadenceForm((f) => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="w-full min-h-[72px] rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
              placeholder="Template da mensagem"
              value={cadenceForm.messageTemplate}
              onChange={(e) => setCadenceForm((f) => ({ ...f, messageTemplate: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={5}
                className="w-28 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                title="Minutos após entrada no estágio"
                value={cadenceForm.triggerAfterMinutes}
                onChange={(e) => setCadenceForm((f) => ({ ...f, triggerAfterMinutes: Number(e.target.value) || 5 }))}
              />
              <select
                className="flex-1 min-w-[140px] rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                value={cadenceForm.stageId}
                onChange={(e) => setCadenceForm((f) => ({ ...f, stageId: e.target.value }))}
              >
                <option value="">Qualquer estágio</option>
                {crmStages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  checked={cadenceForm.isActive}
                  onChange={(e) => setCadenceForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Ativa
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded bg-[#2c348c] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#e42424]"
                onClick={async () => {
                  try {
                    await authClient.saveCrmAutomation({
                      action: "UPSERT_CADENCE",
                      id: cadenceForm.id || undefined,
                      name: cadenceForm.name.trim(),
                      messageTemplate: cadenceForm.messageTemplate.trim(),
                      triggerAfterMinutes: cadenceForm.triggerAfterMinutes,
                      stageId: cadenceForm.stageId || null,
                      isActive: cadenceForm.isActive,
                    });
                    setCadenceForm({
                      id: "",
                      name: "",
                      messageTemplate: "",
                      triggerAfterMinutes: 1440,
                      stageId: "",
                      isActive: true,
                    });
                    await loadAll();
                    setOpsNotice({ title: "Cadência", message: "Salva com sucesso.", variant: "success" });
                  } catch (err) {
                    setOpsNotice({
                      title: "Cadência",
                      message: err instanceof Error ? err.message : "Falha ao salvar.",
                      variant: "error",
                    });
                  }
                }}
              >
                Salvar cadência
              </button>
              {cadenceForm.id && (
                <button
                  type="button"
                  className="rounded border border-slate-200 px-3 py-1.5 text-[11px]"
                  onClick={() =>
                    setCadenceForm({
                      id: "",
                      name: "",
                      messageTemplate: "",
                      triggerAfterMinutes: 1440,
                      stageId: "",
                      isActive: true,
                    })
                  }
                >
                  Nova
                </button>
              )}
            </div>
            <div className="max-h-40 overflow-auto space-y-1 border-t border-slate-100 pt-2">
              {cadences.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="w-full text-left rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] hover:border-[#2c348c]/30"
                  onClick={() =>
                    setCadenceForm({
                      id: String(c.id),
                      name: String(c.name || ""),
                      messageTemplate: String(c.message_template || ""),
                      triggerAfterMinutes: Number(c.trigger_after_minutes || 1440),
                      stageId: c.stage_id ? String(c.stage_id) : "",
                      isActive: c.is_active !== false,
                    })
                  }
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-slate-500"> · {c.stage_name || "—"} · {c.is_active ? "ativa" : "pausada"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-800">Campanha (WhatsApp)</h4>
            <input
              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
              placeholder="Nome da campanha"
              value={campaignForm.name}
              onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="w-full min-h-[72px] rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
              placeholder="Mensagem (texto)"
              value={campaignForm.messageTemplate}
              onChange={(e) => setCampaignForm((f) => ({ ...f, messageTemplate: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                value={campaignForm.status}
                onChange={(e) => setCampaignForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="RUNNING">RUNNING</option>
              </select>
              <select
                className="flex-1 min-w-[120px] rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                value={campaignForm.audienceStageId}
                onChange={(e) => setCampaignForm((f) => ({ ...f, audienceStageId: e.target.value }))}
              >
                <option value="">Público: todos os estágios</option>
                {crmStages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                value={campaignForm.audiencePriority}
                onChange={(e) => setCampaignForm((f) => ({ ...f, audiencePriority: e.target.value }))}
              >
                <option value="">Qualquer prioridade</option>
                <option value="ALTA">ALTA</option>
                <option value="MEDIA">MEDIA</option>
                <option value="BAIXA">BAIXA</option>
              </select>
              <input
                type="number"
                min={1}
                max={500}
                className="w-20 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                title="Limite no filtro"
                value={campaignForm.audienceLimit}
                onChange={(e) => setCampaignForm((f) => ({ ...f, audienceLimit: Number(e.target.value) || 100 }))}
              />
            </div>
            <label className="inline-flex items-center gap-1 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={campaignForm.requireOptIn}
                onChange={(e) => setCampaignForm((f) => ({ ...f, requireOptIn: e.target.checked }))}
              />
              Exigir opt-in (observações do lead com &quot;optin&quot;)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-[#2c348c] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#e42424]"
                onClick={async () => {
                  try {
                    const af: Record<string, unknown> = { limit: Number(campaignForm.audienceLimit || 100) };
                    if (campaignForm.audienceStageId) af.stageId = campaignForm.audienceStageId;
                    if (campaignForm.audiencePriority) af.priority = campaignForm.audiencePriority;
                    await authClient.saveCrmAutomation({
                      action: "UPSERT_CAMPAIGN",
                      id: campaignForm.id || undefined,
                      name: campaignForm.name.trim(),
                      messageTemplate: campaignForm.messageTemplate.trim(),
                      requireOptIn: campaignForm.requireOptIn,
                      status: campaignForm.status,
                      audienceFilter: af,
                    });
                    setCampaignForm({
                      id: "",
                      name: "",
                      messageTemplate: "",
                      requireOptIn: true,
                      status: "DRAFT",
                      audienceStageId: "",
                      audiencePriority: "",
                      audienceLimit: 100,
                    });
                    await loadAll();
                    setOpsNotice({ title: "Campanha", message: "Salva com sucesso.", variant: "success" });
                  } catch (err) {
                    setOpsNotice({
                      title: "Campanha",
                      message: err instanceof Error ? err.message : "Falha ao salvar.",
                      variant: "error",
                    });
                  }
                }}
              >
                Salvar campanha
              </button>
              <input
                type="number"
                min={1}
                max={500}
                className="w-20 rounded border border-slate-200 px-2 py-1 text-[11px]"
                value={queueLimit}
                onChange={(e) => setQueueLimit(Number(e.target.value) || 50)}
                title="Limite ao enfileirar"
              />
            </div>
            <div className="max-h-48 overflow-auto space-y-1 border-t border-slate-100 pt-2">
              {campaigns.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px]">
                  <button
                    type="button"
                    className="text-left font-semibold text-[#2c348c] hover:underline"
                    onClick={() => {
                      const af =
                        c.audience_filter && typeof c.audience_filter === "object"
                          ? (c.audience_filter as Record<string, unknown>)
                          : {};
                      setCampaignForm({
                        id: String(c.id),
                        name: String(c.name || ""),
                        messageTemplate: String(c.message_template || ""),
                        requireOptIn: c.require_opt_in !== false,
                        status: String(c.status || "DRAFT"),
                        audienceStageId: af.stageId ? String(af.stageId) : "",
                        audiencePriority: af.priority ? String(af.priority) : "",
                        audienceLimit: af.limit != null ? Number(af.limit) : 100,
                      });
                    }}
                  >
                    {c.name}
                  </button>
                  <span className="text-slate-500">{c.status}</span>
                  <button
                    type="button"
                    className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white"
                    onClick={async () => {
                      try {
                        const r = await authClient.saveCrmAutomation({
                          action: "QUEUE_CAMPAIGN",
                          campaignId: String(c.id),
                          limit: queueLimit,
                        });
                        await loadAll();
                        setOpsNotice({
                          title: "Fila",
                          message: `Enfileirados: ${r?.queued ?? 0}`,
                          variant: "success",
                        });
                      } catch (err) {
                        setOpsNotice({
                          title: "Fila",
                          message: err instanceof Error ? err.message : "Falha.",
                          variant: "error",
                        });
                      }
                    }}
                  >
                    Enfileirar
                  </button>
                </div>
              ))}
            </div>
          </div>
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
      <div className="surface-card-strong p-4">
        <h3 className="text-sm font-bold text-slate-900">Times de Atendimento</h3>
        <p className="mt-1 text-[11px] text-slate-500">Crie filas de trabalho para distribuir conversas entre atendentes por área.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" placeholder="Nome do time" value={teamForm.name} onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" placeholder="Descrição" value={teamForm.description} onChange={(e) => setTeamForm((f) => ({ ...f, description: e.target.value }))} />
          <button className="pressable-3d rounded bg-gradient-to-r from-[#2c348c] to-[#1f2f86] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmTeam(teamForm); setTeamForm({ id: "", name: "", description: "" }); await loadAll(); }}>Salvar time</button>
        </div>
        <div className="mt-3 space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-800">
                {t.name} <span className="text-slate-500">({(t.members || []).length} membros)</span>
                {(t.members || []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(t.members || []).map((m: any) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700"
                      >
                        {m.username}
                        <button
                          type="button"
                          className="text-red-700 hover:text-red-800"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await authClient.removeCrmMemberFromTeam({ username: m.username, teamId: t.id });
                            await loadAll();
                          }}
                        >
                          Remover
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button className="text-[11px] text-red-700 hover:text-red-800" onClick={async () => { await authClient.deleteCrmTeam(t.id); await loadAll(); }}>Excluir</button>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card-strong p-4 border border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white">
        <h3 className="text-sm font-bold text-slate-900">Caixas WhatsApp Web (Evolution API)</h3>
        <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
          <a className="font-semibold text-[#2c348c] underline" href="https://github.com/EvolutionAPI/evolution-api" target="_blank" rel="noreferrer">
            Evolution API
          </a>{" "}
          — <strong>modo rápido</strong>: quem usa o CRM só informa o <strong>nome da linha</strong>; URL e chave da Evolution ficam no servidor (
          <code className="text-[10px] bg-slate-100 px-1 rounded">EVOLUTION_API_URL</code> +{" "}
          <code className="text-[10px] bg-slate-100 px-1 rounded">EVOLUTION_API_KEY</code> na Vercel). Depois abrimos o QR aqui mesmo.
        </p>
        {evolutionDefaultsConfigured ? (
          <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-900">
            Modo rápido <strong>disponível</strong> — URL e chave já estão configuradas no servidor.
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
            Configure <code className="text-[10px] bg-white/80 px-1 rounded">EVOLUTION_API_URL</code> e{" "}
            <code className="text-[10px] bg-white/80 px-1 rounded">EVOLUTION_API_KEY</code> na Vercel para liberar o modo rápido, ou use{" "}
            <strong>Modo TI</strong> abaixo.
          </div>
        )}
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-[10px] text-emerald-100 font-mono break-all">
          {webhookHint ? `${webhookHint}?token=SEU_EVOLUTION_WEBHOOK_TOKEN` : "/api/whatsapp/evolution/webhook?token=..."}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Token <code className="bg-slate-100 px-1 rounded">EVOLUTION_WEBHOOK_TOKEN</code> — eventos recomendados:{" "}
          <strong>MESSAGES_UPSERT</strong>, <strong>QRCODE_UPDATED</strong>, <strong>CONNECTION_UPDATE</strong>.
        </p>

        {!evoForm.id && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!evolutionDefaultsConfigured}
              onClick={() => setEvoAdvancedOpen(false)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                !evoAdvancedOpen ? "border-[#2c348c] bg-[#2c348c]/10 text-[#06183e]" : "border-slate-200 bg-white text-slate-600"
              } disabled:opacity-40`}
            >
              Modo rápido
            </button>
            <button
              type="button"
              onClick={() => setEvoAdvancedOpen(true)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                evoAdvancedOpen ? "border-slate-700 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              Modo TI (URL e chave)
            </button>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800"
            placeholder="Nome desta linha no CRM (ex.: Brenda - Comercial)"
            value={evoForm.name}
            onChange={(e) => setEvoForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800"
            placeholder={
              evoForm.id || evoAdvancedOpen
                ? "Nome da instância na Evolution (ex.: brenda-sle)"
                : "ID da instância (opcional — vazio = geramos automaticamente)"
            }
            value={evoForm.evolutionInstanceName}
            onChange={(e) => setEvoForm((f) => ({ ...f, evolutionInstanceName: e.target.value }))}
          />
          {(evoForm.id || evoAdvancedOpen) && (
            <>
              <input
                className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 md:col-span-2"
                placeholder="URL do servidor Evolution"
                value={evoForm.evolutionServerUrl}
                onChange={(e) => setEvoForm((f) => ({ ...f, evolutionServerUrl: e.target.value }))}
              />
              <input
                className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 md:col-span-2"
                placeholder="Chave API Evolution — vazio ao editar mantém a atual"
                value={evoForm.evolutionApiKey}
                onChange={(e) => setEvoForm((f) => ({ ...f, evolutionApiKey: e.target.value }))}
              />
            </>
          )}
          <select
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 md:col-span-2"
            value={evoForm.teamId}
            onChange={(e) => setEvoForm((f) => ({ ...f, teamId: e.target.value }))}
          >
            <option value="">Time (opcional)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 md:col-span-2"
            value={evoForm.ownerUsername}
            onChange={(e) => setEvoForm((f) => ({ ...f, ownerUsername: e.target.value }))}
          >
            <option value="">Dono da caixa (fallback para time quando offline)</option>
            {agents.map((a) => <option key={a.username} value={a.username}>{a.username}</option>)}
          </select>
          {!evoForm.id && (
            <label className="flex items-center gap-2 md:col-span-2 text-[11px] text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={provisionEvolutionInstance}
                onChange={(e) => setProvisionEvolutionInstance(e.target.checked)}
              />
              <span>Criar instância na Evolution ao salvar (recomendado no modo rápido)</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="button"
              className="pressable-3d flex-1 rounded bg-gradient-to-r from-emerald-700 to-emerald-600 text-xs text-white font-bold"
              onClick={async () => {
                try {
                  const isNew = !evoForm.id;
                  const useSimple = isNew && evolutionDefaultsConfigured && !evoAdvancedOpen;
                  if (isNew && !evolutionDefaultsConfigured && !evoAdvancedOpen) {
                    setErrorText("Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor ou use Modo TI.");
                    return;
                  }
                  const payload: Record<string, unknown> = {
                    action: "UPSERT_EVOLUTION",
                    name: evoForm.name.trim(),
                    teamId: evoForm.teamId || null,
                    ownerUsername: evoForm.ownerUsername || null,
                  };
                  if (evoForm.id) payload.id = evoForm.id;

                  if (useSimple) {
                    payload.simpleConnect = true;
                    const inst = evoForm.evolutionInstanceName.trim();
                    if (inst) payload.evolutionInstanceName = inst;
                    payload.provisionEvolutionInstance = provisionEvolutionInstance;
                  } else {
                    payload.simpleConnect = false;
                    payload.evolutionInstanceName = evoForm.evolutionInstanceName.trim();
                    payload.evolutionServerUrl = evoForm.evolutionServerUrl.trim();
                    if (evoForm.evolutionApiKey.trim()) payload.evolutionApiKey = evoForm.evolutionApiKey.trim();
                    payload.provisionEvolutionInstance = isNew && provisionEvolutionInstance;
                  }

                  if (!payload.name) {
                    setErrorText("Informe o nome da linha.");
                    return;
                  }
                  if (!useSimple && isNew) {
                    if (!payload.evolutionInstanceName || !String(payload.evolutionInstanceName).trim()) {
                      setErrorText("No modo TI, informe o nome da instância na Evolution.");
                      return;
                    }
                    if (!String(payload.evolutionServerUrl || "").trim()) {
                      setErrorText("No modo TI, informe a URL do servidor Evolution.");
                      return;
                    }
                  }

                  const res = (await authClient.saveCrmWhatsappInbox(payload as any)) as {
                    id?: string;
                    evolutionInstanceName?: string;
                    webhookSync?: { ok?: boolean; error?: string };
                  };

                  if (res?.webhookSync && res.webhookSync.ok === false) {
                    setOpsNotice({
                      title: "Webhook na Evolution",
                      message: `${res.webhookSync.error || "Não foi possível gravar o webhook na API."} Se a URL no Manager continuar vazia, gere o QR novamente no pareamento e confira NEXT_PUBLIC_APP_URL na Vercel.`,
                      variant: "warning",
                    });
                  }

                  if (useSimple && res?.id) {
                    setPairInbox({
                      id: res.id,
                      name: evoForm.name.trim(),
                      evolutionInstanceName: res.evolutionInstanceName || evoForm.evolutionInstanceName || null,
                      autoStartSyncWebhook: true,
                    });
                  }

                  setEvoForm({
                    id: "",
                    name: "",
                    evolutionInstanceName: "",
                    evolutionServerUrl: "",
                    evolutionApiKey: "",
                    teamId: "",
                    ownerUsername: "",
                  });
                  setProvisionEvolutionInstance(true);
                  setEvoAdvancedOpen(false);
                  setErrorText(null);
                  await loadAll();
                } catch (err) {
                  setErrorText(err instanceof Error ? err.message : "Falha ao salvar caixa.");
                }
              }}
            >
              {!evoForm.id && evolutionDefaultsConfigured && !evoAdvancedOpen
                ? "Adicionar número e conectar"
                : "Salvar caixa Web"}
            </button>
            {!evoForm.id && (
              <button
                type="button"
                className="rounded border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"
                onClick={() => {
                  setEvoForm({
                    id: "",
                    name: "",
                    evolutionInstanceName: "",
                    evolutionServerUrl: "",
                    evolutionApiKey: "",
                    teamId: "",
                    ownerUsername: "",
                  });
                  setProvisionEvolutionInstance(true);
                  setEvoAdvancedOpen(false);
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {waInboxes
            .filter((x) => String(x.provider).toUpperCase() === "EVOLUTION" && x.isActive !== false)
            .map((ib) => (
              <div
                key={ib.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              >
                <div>
                  <span className="font-semibold">{ib.name}</span>
                  <span className="text-slate-500"> — instância </span>
                  <code className="text-[10px] bg-slate-100 px-1 rounded">{ib.evolutionInstanceName}</code>
                  <span className="text-slate-500"> · API </span>
                  <span className="text-[10px]">{ib.evolutionApiKeyLast4 || "—"}</span>
                  <span className="text-slate-500"> · dono </span>
                  <span className="text-[10px] font-semibold">{ib.ownerUsername || "sem dono"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] text-emerald-700 hover:underline font-semibold"
                    onClick={() =>
                      setPairInbox({
                        id: ib.id,
                        name: ib.name,
                        evolutionInstanceName: ib.evolutionInstanceName,
                      })
                    }
                  >
                    Parear no site
                  </button>
                  <a
                    href={`/evolution-pairing?instance=${encodeURIComponent(String(ib.evolutionInstanceName || ""))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    Abrir página /evolution-pairing
                  </a>
                  <button
                    type="button"
                    className="text-[11px] text-[#2c348c] hover:underline"
                    onClick={() => {
                      setEvoAdvancedOpen(true);
                      setEvoForm({
                        id: ib.id,
                        name: ib.name,
                        evolutionInstanceName: ib.evolutionInstanceName || "",
                        evolutionServerUrl: ib.evolutionServerUrl || "",
                        evolutionApiKey: "",
                        teamId: ib.teamId || "",
                        ownerUsername: ib.ownerUsername || "",
                      });
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-red-700"
                    onClick={async () => {
                      await authClient.saveCrmWhatsappInbox({ action: "DELETE", id: ib.id });
                      await loadAll();
                    }}
                  >
                    Desativar
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="surface-card-strong p-4 border border-violet-200/60 bg-gradient-to-br from-violet-50/40 to-white">
        <h3 className="text-sm font-bold text-slate-900">Triagem de novos contatos (anti-poluição)</h3>
        <p className="mt-1 text-[11px] text-slate-600">
          Evita criar lead para amigo/família/contato pessoal. Números de agência cadastrados continuam entrando.
          Pendentes na triagem: <strong>{pendingIntakeCount}</strong>.
        </p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800"
            value={intakeSettings.leadFilterMode}
            onChange={(e) => setIntakeSettings((s) => ({ ...s, leadFilterMode: e.target.value }))}
          >
            <option value="OFF">OFF (cria lead para todo contato novo)</option>
            <option value="BUSINESS_ONLY">BUSINESS_ONLY (recomendado)</option>
            <option value="AGENCY_ONLY">AGENCY_ONLY (só agências)</option>
          </select>
          <input
            type="number"
            min={1}
            max={10}
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800"
            value={intakeSettings.minMessagesBeforeCreate}
            onChange={(e) =>
              setIntakeSettings((s) => ({
                ...s,
                minMessagesBeforeCreate: Number(e.target.value) || 2,
              }))
            }
            placeholder="Mensagens mínimas para decidir"
          />
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={!!intakeSettings.aiEnabled}
              onChange={(e) => setIntakeSettings((s) => ({ ...s, aiEnabled: e.target.checked }))}
            />
            IA ativa para decidir contato novo duvidoso
          </label>
          <div />
          <textarea
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 md:col-span-2 min-h-[60px]"
            placeholder="Allowlist (últimos 10 dígitos), separados por vírgula"
            value={intakeSettings.allowlistLast10}
            onChange={(e) => setIntakeSettings((s) => ({ ...s, allowlistLast10: e.target.value }))}
          />
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <label className="text-[11px] rounded border border-slate-200 bg-white px-2 py-1 cursor-pointer hover:bg-slate-50">
              Importar CSV/XLSX (allowlist)
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await importListFile(file, "ALLOW");
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 md:col-span-2 min-h-[60px]"
            placeholder="Denylist (últimos 10 dígitos), separados por vírgula"
            value={intakeSettings.denylistLast10}
            onChange={(e) => setIntakeSettings((s) => ({ ...s, denylistLast10: e.target.value }))}
          />
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <label className="text-[11px] rounded border border-slate-200 bg-white px-2 py-1 cursor-pointer hover:bg-slate-50">
              Importar CSV/XLSX (denylist)
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await importListFile(file, "DENY");
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="text-[11px] rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
              onClick={downloadTemplateCsv}
            >
              Baixar template CSV
            </button>
            <button
              type="button"
              className="text-[11px] rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
              onClick={downloadTemplateXlsx}
            >
              Baixar template XLSX
            </button>
          </div>
          <button
            type="button"
            className="pressable-3d rounded bg-gradient-to-r from-violet-700 to-violet-600 text-xs text-white font-bold px-3 py-2"
            onClick={async () => {
              await authClient.saveCrmEvolutionIntakeSettings({
                leadFilterMode: intakeSettings.leadFilterMode as any,
                aiEnabled: !!intakeSettings.aiEnabled,
                minMessagesBeforeCreate: Number(intakeSettings.minMessagesBeforeCreate || 2),
                metaLeadFilterMode: intakeSettings.metaLeadFilterMode as any,
                metaAiEnabled: !!intakeSettings.metaAiEnabled,
                metaMinMessagesBeforeCreate: Number(intakeSettings.metaMinMessagesBeforeCreate || 1),
                allowlistLast10: intakeSettings.allowlistLast10 || "",
                denylistLast10: intakeSettings.denylistLast10 || "",
              });
              await loadAll();
            }}
          >
            Salvar triagem
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 rounded border border-slate-200 bg-slate-50 p-2">
          <div className="text-[11px] font-semibold text-slate-700 md:col-span-2">
            Política da linha oficial (Meta)
          </div>
          <select
            className="rounded bg-white border border-slate-200 px-2 py-2 text-xs text-slate-800"
            value={intakeSettings.metaLeadFilterMode}
            onChange={(e) => setIntakeSettings((s) => ({ ...s, metaLeadFilterMode: e.target.value }))}
          >
            <option value="OFF">OFF (cria lead para todo contato novo)</option>
            <option value="BUSINESS_ONLY">BUSINESS_ONLY (recomendado)</option>
            <option value="AGENCY_ONLY">AGENCY_ONLY (só agências)</option>
          </select>
          <input
            type="number"
            min={1}
            max={10}
            className="rounded bg-white border border-slate-200 px-2 py-2 text-xs text-slate-800"
            value={intakeSettings.metaMinMessagesBeforeCreate}
            onChange={(e) =>
              setIntakeSettings((s) => ({ ...s, metaMinMessagesBeforeCreate: Number(e.target.value) || 1 }))
            }
          />
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={!!intakeSettings.metaAiEnabled}
              onChange={(e) => setIntakeSettings((s) => ({ ...s, metaAiEnabled: e.target.checked }))}
            />
            IA ativa para decisão de contato novo no canal Meta
          </label>
        </div>
        <div className="mt-4 rounded-xl border border-violet-200 bg-white p-3">
          <h4 className="text-xs font-bold text-slate-900">Pendentes para decisão manual</h4>
          <p className="mt-1 text-[11px] text-slate-600">
            Aprovar cria (ou vincula) o lead. Rejeitar remove da triagem pendente.
          </p>
          <div className="mt-2 max-h-72 overflow-y-auto space-y-2">
            {intakeBufferItems.length === 0 && (
              <div className="text-[11px] text-slate-500">Nenhum contato pendente na triagem.</div>
            )}
            {intakeBufferItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-800">
                    <strong>{item.profileName || "Contato sem nome"}</strong> · {item.phoneDigits || item.phoneLast10}
                    <span className="text-slate-500"> · caixa: {item.inboxName || "—"} · msgs: {item.messageCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                      onClick={async () => {
                        await authClient.decideCrmEvolutionIntakeBuffer({
                          action: "APPROVE",
                          bufferId: String(item.id),
                          actor: user?.username || null,
                        });
                        await loadAll();
                      }}
                    >
                      Aprovar lead
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800"
                      onClick={async () => {
                        await authClient.decideCrmEvolutionIntakeBuffer({
                          action: "REJECT",
                          bufferId: String(item.id),
                          actor: user?.username || null,
                        });
                        await loadAll();
                      }}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-slate-600">{item.sampleText || "Sem texto amostra"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card-strong p-4">
        <h3 className="text-sm font-bold text-slate-900">SLA por fila</h3>
        <p className="mt-1 text-[11px] text-slate-500">Define o tempo máximo de resposta por tema/canal/time para medir estouro de SLA.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={slaForm.teamId} onChange={(e) => setSlaForm((f) => ({ ...f, teamId: e.target.value }))}>
            <option value="">Todos os times</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" placeholder="Tema (ex: RASTREIO)" value={slaForm.topic} onChange={(e) => setSlaForm((f) => ({ ...f, topic: e.target.value }))} />
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={slaForm.channel} onChange={(e) => setSlaForm((f) => ({ ...f, channel: e.target.value }))}>
            <option value="WHATSAPP">WHATSAPP</option>
            <option value="IA">IA</option>
            <option value="INTERNO">INTERNO</option>
          </select>
          <input type="number" className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={slaForm.slaMinutes} onChange={(e) => setSlaForm((f) => ({ ...f, slaMinutes: Number(e.target.value) || 30 }))} />
          <button className="pressable-3d rounded bg-gradient-to-r from-[#2c348c] to-[#1f2f86] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmSlaRule(slaForm); setSlaForm({ teamId: "", topic: "", channel: "WHATSAPP", priority: "MEDIA", slaMinutes: 30 }); await loadAll(); }}>Salvar SLA</button>
        </div>
        <div className="mt-3 space-y-2">
          {slaRules.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span>{s.topic || "GERAL"} / {s.channel || "ANY"} / {s.teamId || "GLOBAL"} = {s.slaMinutes} min</span>
              <button className="text-red-700 hover:text-red-800" onClick={async () => { await authClient.deleteCrmSlaRule(s.id); await loadAll(); }}>Excluir</button>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card-strong p-4">
        <h3 className="text-sm font-bold text-slate-900">Membros dos Times</h3>
        <p className="mt-1 text-[11px] text-slate-500">Vincula usuários aos times para roteamento automático e permissões por escopo.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={memberForm.teamId} onChange={(e) => setMemberForm((f) => ({ ...f, teamId: e.target.value }))}>
            <option value="">Selecione time</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={memberForm.username} onChange={(e) => setMemberForm((f) => ({ ...f, username: e.target.value }))}>
            <option value="">Selecione atendente</option>
            {agents.map((a) => <option key={a.username} value={a.username}>{a.username}</option>)}
          </select>
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={memberForm.memberRole} onChange={(e) => setMemberForm((f) => ({ ...f, memberRole: e.target.value }))}>
            <option value="ATENDENTE">Atendente</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
          <button className="pressable-3d rounded bg-gradient-to-r from-[#2c348c] to-[#1f2f86] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmTeamMember(memberForm); setMemberForm({ teamId: "", username: "", memberRole: "ATENDENTE" }); await loadAll(); }}>Adicionar membro</button>
        </div>
      </div>

      <div className="surface-card-strong p-4">
        <h3 className="text-sm font-bold text-slate-900">Regras de Roteamento</h3>
        <p className="mt-1 text-[11px] text-slate-500">Automatiza para onde cada lead/conversa vai, com prioridade e critérios de tema/texto.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" placeholder="Nome da regra" value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" type="number" placeholder="Prioridade" value={ruleForm.priority} onChange={(e) => setRuleForm((f) => ({ ...f, priority: Number(e.target.value) || 100 }))} />
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={ruleForm.matchType} onChange={(e) => setRuleForm((f) => ({ ...f, matchType: e.target.value }))}>
            <option value="TOPIC">TOPIC</option>
            <option value="CONTAINS">CONTAINS</option>
            <option value="REGEX">REGEX</option>
          </select>
          <input className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" placeholder="Valor de match" value={ruleForm.matchValue} onChange={(e) => setRuleForm((f) => ({ ...f, matchValue: e.target.value }))} />
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={ruleForm.targetType} onChange={(e) => setRuleForm((f) => ({ ...f, targetType: e.target.value }))}>
            <option value="USER">USER</option>
            <option value="TEAM">TEAM</option>
            <option value="NONE">NONE</option>
          </select>
          <button className="pressable-3d rounded bg-gradient-to-r from-[#2c348c] to-[#1f2f86] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmRoutingRule(ruleForm); setRuleForm({ id: "", name: "", priority: 100, matchType: "TOPIC", matchValue: "", targetType: "USER", targetUsername: "", targetTeamId: "", targetStageId: "" }); await loadAll(); }}>Salvar regra</button>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={ruleForm.targetUsername} onChange={(e) => setRuleForm((f) => ({ ...f, targetUsername: e.target.value }))}>
            <option value="">Target user</option>
            {agents.map((a) => <option key={a.username} value={a.username}>{a.username}</option>)}
          </select>
          <select className="rounded bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800" value={ruleForm.targetTeamId} onChange={(e) => setRuleForm((f) => ({ ...f, targetTeamId: e.target.value }))}>
            <option value="">Target team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              [{r.priority}] {r.name} :: {r.matchType}={r.matchValue} {"->"} {r.targetType} {r.targetUsername || r.targetTeamName || "-"}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-md">
          Atualizando dados de operação CRM...
        </div>
      )}
    </div>
    </>
  );
};

export default CrmOpsAdmin;

