import React, { useEffect, useState } from "react";
import { authClient } from "../lib/auth";

const CrmOpsAdmin: React.FC = () => {
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

  const loadAll = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [t, a, r] = await Promise.all([
        authClient.getCrmTeams(),
        authClient.getCrmAgents(),
        authClient.getCrmRoutingRules(),
      ]);
      const s = await authClient.getCrmSlaRules();
      setTeams(Array.isArray(t?.teams) ? t.teams : []);
      setAgents(Array.isArray(a?.agents) ? a.agents : []);
      setRules(Array.isArray(r?.rules) ? r.rules : []);
      setSlaRules(Array.isArray(s?.items) ? s.items : []);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Falha ao carregar operação CRM.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="space-y-4">
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
      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4">
        <h3 className="text-sm font-bold text-white">Times de Atendimento</h3>
        <p className="mt-1 text-[11px] text-gray-400">Crie filas de trabalho para distribuir conversas entre atendentes por área.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" placeholder="Nome do time" value={teamForm.name} onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" placeholder="Descrição" value={teamForm.description} onChange={(e) => setTeamForm((f) => ({ ...f, description: e.target.value }))} />
          <button className="rounded bg-[#1A1B62] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmTeam(teamForm); setTeamForm({ id: "", name: "", description: "" }); await loadAll(); }}>Salvar time</button>
        </div>
        <div className="mt-3 space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border border-[#1A1B62] bg-[#080816] px-3 py-2">
              <div className="text-xs text-gray-100">{t.name} <span className="text-gray-400">({(t.members || []).length} membros)</span></div>
              <button className="text-[11px] text-red-300" onClick={async () => { await authClient.deleteCrmTeam(t.id); await loadAll(); }}>Excluir</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4">
        <h3 className="text-sm font-bold text-white">SLA por fila</h3>
        <p className="mt-1 text-[11px] text-gray-400">Define o tempo máximo de resposta por tema/canal/time para medir estouro de SLA.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={slaForm.teamId} onChange={(e) => setSlaForm((f) => ({ ...f, teamId: e.target.value }))}>
            <option value="">Todos os times</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" placeholder="Tema (ex: RASTREIO)" value={slaForm.topic} onChange={(e) => setSlaForm((f) => ({ ...f, topic: e.target.value }))} />
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={slaForm.channel} onChange={(e) => setSlaForm((f) => ({ ...f, channel: e.target.value }))}>
            <option value="WHATSAPP">WHATSAPP</option>
            <option value="IA">IA</option>
            <option value="INTERNO">INTERNO</option>
          </select>
          <input type="number" className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={slaForm.slaMinutes} onChange={(e) => setSlaForm((f) => ({ ...f, slaMinutes: Number(e.target.value) || 30 }))} />
          <button className="rounded bg-[#1A1B62] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmSlaRule(slaForm); setSlaForm({ teamId: "", topic: "", channel: "WHATSAPP", priority: "MEDIA", slaMinutes: 30 }); await loadAll(); }}>Salvar SLA</button>
        </div>
        <div className="mt-3 space-y-2">
          {slaRules.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-[#1A1B62] bg-[#080816] px-3 py-2 text-xs text-gray-200">
              <span>{s.topic || "GERAL"} / {s.channel || "ANY"} / {s.teamId || "GLOBAL"} = {s.slaMinutes} min</span>
              <button className="text-red-300" onClick={async () => { await authClient.deleteCrmSlaRule(s.id); await loadAll(); }}>Excluir</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4">
        <h3 className="text-sm font-bold text-white">Membros dos Times</h3>
        <p className="mt-1 text-[11px] text-gray-400">Vincula usuários aos times para roteamento automático e permissões por escopo.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={memberForm.teamId} onChange={(e) => setMemberForm((f) => ({ ...f, teamId: e.target.value }))}>
            <option value="">Selecione time</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={memberForm.username} onChange={(e) => setMemberForm((f) => ({ ...f, username: e.target.value }))}>
            <option value="">Selecione atendente</option>
            {agents.map((a) => <option key={a.username} value={a.username}>{a.username}</option>)}
          </select>
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={memberForm.memberRole} onChange={(e) => setMemberForm((f) => ({ ...f, memberRole: e.target.value }))}>
            <option value="ATENDENTE">Atendente</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
          <button className="rounded bg-[#1A1B62] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmTeamMember(memberForm); setMemberForm({ teamId: "", username: "", memberRole: "ATENDENTE" }); await loadAll(); }}>Adicionar membro</button>
        </div>
      </div>

      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4">
        <h3 className="text-sm font-bold text-white">Regras de Roteamento</h3>
        <p className="mt-1 text-[11px] text-gray-400">Automatiza para onde cada lead/conversa vai, com prioridade e critérios de tema/texto.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" placeholder="Nome da regra" value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" type="number" placeholder="Prioridade" value={ruleForm.priority} onChange={(e) => setRuleForm((f) => ({ ...f, priority: Number(e.target.value) || 100 }))} />
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={ruleForm.matchType} onChange={(e) => setRuleForm((f) => ({ ...f, matchType: e.target.value }))}>
            <option value="TOPIC">TOPIC</option>
            <option value="CONTAINS">CONTAINS</option>
            <option value="REGEX">REGEX</option>
          </select>
          <input className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" placeholder="Valor de match" value={ruleForm.matchValue} onChange={(e) => setRuleForm((f) => ({ ...f, matchValue: e.target.value }))} />
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={ruleForm.targetType} onChange={(e) => setRuleForm((f) => ({ ...f, targetType: e.target.value }))}>
            <option value="USER">USER</option>
            <option value="TEAM">TEAM</option>
            <option value="NONE">NONE</option>
          </select>
          <button className="rounded bg-[#1A1B62] text-xs text-white font-bold" onClick={async () => { await authClient.saveCrmRoutingRule(ruleForm); setRuleForm({ id: "", name: "", priority: 100, matchType: "TOPIC", matchValue: "", targetType: "USER", targetUsername: "", targetTeamId: "", targetStageId: "" }); await loadAll(); }}>Salvar regra</button>
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={ruleForm.targetUsername} onChange={(e) => setRuleForm((f) => ({ ...f, targetUsername: e.target.value }))}>
            <option value="">Target user</option>
            {agents.map((a) => <option key={a.username} value={a.username}>{a.username}</option>)}
          </select>
          <select className="rounded bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100" value={ruleForm.targetTeamId} onChange={(e) => setRuleForm((f) => ({ ...f, targetTeamId: e.target.value }))}>
            <option value="">Target team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded border border-[#1A1B62] bg-[#080816] px-3 py-2 text-xs text-gray-200">
              [{r.priority}] {r.name} :: {r.matchType}={r.matchValue} {"->"} {r.targetType} {r.targetUsername || r.targetTeamName || "-"}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-[#2B2F8F] bg-[#070A20] px-3 py-2 text-xs text-gray-100 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
          Atualizando dados de operação CRM...
        </div>
      )}
    </div>
  );
};

export default CrmOpsAdmin;

