import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, Save, Send, MessageSquare, Building2, Bell } from "lucide-react";
import { authClient } from "../lib/auth";
import { useAuth } from "../context/AuthContext";

type Props = {
  indemnificationId: string | null;
  onClose: () => void;
  onUpdated: () => void;
};

function playChaseBeep() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem("sle_ocorrencias_chase_sound") === "0") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.06;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => {});
    }, 140);
  } catch {
    /* noop */
  }
}

function canActOnWorkflow(username: string, role: string, currentAssignee: string | null | undefined, state: string) {
  if (String(role || "").toLowerCase() === "admin") return true;
  const st = String(state || "").toUpperCase();
  if (st === "AGUARDANDO_APROVACAO") {
    if (!currentAssignee) return true;
    return String(currentAssignee).toLowerCase() === String(username).toLowerCase();
  }
  if (st === "LANCAMENTOS" || st === "AGUARDANDO_FINANCEIRO") {
    if (!currentAssignee) return true;
    return String(currentAssignee).toLowerCase() === String(username).toLowerCase();
  }
  return true;
}

const IndemnificationModal: React.FC<Props> = ({ indemnificationId, onClose, onUpdated }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState<any>(null);
  const [notesList, setNotesList] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [facts, setFacts] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [indemnificationBody, setIndemnificationBody] = useState("");
  const [others, setOthers] = useState("");
  const [editComment, setEditComment] = useState("");

  const [assigneeUsername, setAssigneeUsername] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [nextAssignee, setNextAssignee] = useState("");
  const [lancamentosAssignee, setLancamentosAssignee] = useState("");
  const [financeAssignee, setFinanceAssignee] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteAgencyId, setNewNoteAgencyId] = useState("");
  const [linkNoteId, setLinkNoteId] = useState<Record<string, string>>({});
  const [addAgencyId, setAddAgencyId] = useState("");
  const [expectedBy, setExpectedBy] = useState("");

  const load = useCallback(async () => {
    if (!indemnificationId) return;
    setLoading(true);
    setErr("");
    try {
      const w = await authClient.getIndemnificationWorkflow(indemnificationId);
      setPayload(w);
      const ind = w.indemnification;
      setFacts(String(ind?.facts ?? ""));
      setResponsibilities(String(ind?.responsibilities ?? ""));
      setIndemnificationBody(String(ind?.indemnification_body ?? ""));
      setOthers(String(ind?.others ?? ""));
      const cte = String(ind?.occurrence_cte || "");
      if (cte) {
        const n = await authClient.getNotesForCte(cte);
        setNotesList(Array.isArray(n) ? n : []);
      } else {
        setNotesList([]);
      }
      const ag = await authClient.getCrmAgenciesList();
      setAgencies(Array.isArray(ag.items) ? ag.items : []);
    } catch (e: any) {
      setErr(e?.message || "Falha ao carregar.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [indemnificationId]);

  useEffect(() => {
    if (!indemnificationId) return;
    load();
    (async () => {
      try {
        const u = await authClient.getUsers();
        setUsers(Array.isArray(u) ? u : []);
      } catch {
        setUsers([]);
      }
    })();
  }, [indemnificationId, load]);

  const wf = payload?.workflow;
  const ind = payload?.indemnification;
  const followups = useMemo(() => (Array.isArray(payload?.followups) ? payload.followups : []), [payload]);
  const events = useMemo(() => (Array.isArray(payload?.events) ? payload.events : []), [payload]);

  const username = user?.username || "";
  const role = user?.role || "";
  const wfState = String(wf?.state || "").toUpperCase();
  const canApproveReject = wfState === "AGUARDANDO_APROVACAO" && canActOnWorkflow(username, role, wf?.current_assignee, wfState);

  const userOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const u of users) {
      const un = String(u?.username || u?.user || "").trim();
      if (!un || seen.has(un.toLowerCase())) continue;
      seen.add(un.toLowerCase());
      opts.push({ value: un, label: un });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [users]);

  const agencyOptions = useMemo(() => {
    const taken = new Set(followups.map((f: any) => String(f.agency_id || "")));
    return agencies.filter((a: any) => a?.id && !taken.has(String(a.id)));
  }, [agencies, followups]);

  const saveFields = async () => {
    if (!indemnificationId) return;
    setErr("");
    try {
      await authClient.postIndemnificationWorkflow({
        action: "update_fields",
        indemnificationId,
        facts,
        responsibilities,
        indemnification_body: indemnificationBody,
        others,
        editComment: editComment.trim() || undefined,
      });
      setEditComment("");
      await load();
      onUpdated();
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar campos.");
    }
  };

  const postAction = async (body: Record<string, unknown>) => {
    if (!indemnificationId) return false;
    setErr("");
    try {
      await authClient.postIndemnificationWorkflow({ indemnificationId, ...body });
      await load();
      onUpdated();
      return true;
    } catch (e: any) {
      setErr(e?.message || "Ação não concluída.");
      return false;
    }
  };

  const addFollowup = async () => {
    if (!indemnificationId || !addAgencyId) return;
    setErr("");
    try {
      await authClient.postIndemnificationFollowup({
        indemnificationId,
        agencyId: addAgencyId,
        expectedBy: expectedBy || undefined,
      });
      setAddAgencyId("");
      setExpectedBy("");
      await load();
      onUpdated();
    } catch (e: any) {
      setErr(e?.message || "Falha ao adicionar agência.");
    }
  };

  const chaseAgency = async (followupId: string) => {
    setErr("");
    try {
      await authClient.patchIndemnificationFollowup({ id: followupId, action: "chase" });
      playChaseBeep();
      await load();
      onUpdated();
    } catch (e: any) {
      setErr(e?.message || "Falha ao cobrar retorno.");
    }
  };

  const linkNote = async (followupId: string) => {
    const raw = linkNoteId[followupId];
    const noteId = raw ? Number(raw) : NaN;
    if (!Number.isFinite(noteId)) {
      setErr("Selecione uma nota para vincular.");
      return;
    }
    setErr("");
    try {
      await authClient.patchIndemnificationFollowup({ id: followupId, action: "link_note", noteId });
      await load();
      onUpdated();
    } catch (e: any) {
      setErr(e?.message || "Falha ao vincular nota.");
    }
  };

  const submitNewNote = async () => {
    if (!ind || !username) return;
    const t = newNoteText.trim();
    if (!t) {
      setErr("Digite o texto da nota.");
      return;
    }
    setErr("");
    try {
      await authClient.addNote({
        cte: String(ind.occurrence_cte || ""),
        serie: String(ind.occurrence_serie || "0"),
        codigo: "",
        usuario: username,
        texto: t,
        link_imagem: "",
        status_busca: "",
        agency_id: newNoteAgencyId || undefined,
        indemnification_id: indemnificationId,
      });
      setNewNoteText("");
      setNewNoteAgencyId("");
      await load();
      onUpdated();
    } catch (e: any) {
      setErr(e?.message || "Falha ao registrar nota.");
    }
  };

  if (!indemnificationId) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="surface-card max-h-[92vh] w-full max-w-4xl overflow-hidden flex flex-col shadow-xl border border-slate-200">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 bg-slate-50/80">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Indenização — fluxo</p>
            <p className="text-sm font-bold text-slate-800 font-mono">
              CTE {ind?.occurrence_cte || "—"} / {ind?.occurrence_serie || "0"}
            </p>
            {wf && (
              <p className="text-[11px] text-slate-600 mt-0.5">
                Estado: <strong>{wf.state}</strong>
                {wf.current_assignee ? ` · Responsável: ${wf.current_assignee}` : ""}
                {wf.rejection_reason ? ` · Motivo: ${wf.rejection_reason}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {err && <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-800">{err}</p>}

          {loading && !payload ? (
            <p className="flex items-center gap-2 text-slate-500">
              <Loader2 className="animate-spin" size={16} /> Carregando…
            </p>
          ) : null}

          {payload && (
            <>
              <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Save size={14} /> Campos estruturados
                </p>
                <label className="block">
                  <span className="font-bold text-slate-600">Dos fatos</span>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 p-2 min-h-[64px] text-xs"
                    value={facts}
                    onChange={(e) => setFacts(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-slate-600">Das responsabilidades</span>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 p-2 min-h-[64px] text-xs"
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-slate-600">Da indenização</span>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 p-2 min-h-[64px] text-xs"
                    value={indemnificationBody}
                    onChange={(e) => setIndemnificationBody(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-slate-600">Outros</span>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 p-2 min-h-[48px] text-xs"
                    value={others}
                    onChange={(e) => setOthers(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Comentário da alteração (auditoria)</span>
                  <input
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="Opcional — recomendado se já houve envio para aprovação"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveFields}
                  disabled={loading}
                  className="rounded-lg bg-sl-navy px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  Salvar campos
                </button>
              </section>

              <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Send size={14} /> Enviar para aprovação
                </p>
                <p className="text-[10px] text-slate-500">Disponível em RASCUNHO ou DEVOLVIDO. Marque a confirmação abaixo.</p>
                <select
                  className="w-full max-w-md rounded border border-slate-200 px-2 py-1"
                  value={assigneeUsername}
                  onChange={(e) => setAssigneeUsername(e.target.value)}
                >
                  <option value="">Selecione o aprovador…</option>
                  {userOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-[11px]">
                  <input type="checkbox" checked={confirmSend} onChange={(e) => setConfirmSend(e.target.checked)} />
                  Confirmo o envio para aprovação
                </label>
                <button
                  type="button"
                  onClick={() =>
                    postAction({
                      action: "submit_approval",
                      assigneeUsername,
                      confirmSend,
                    })
                  }
                  disabled={loading}
                  className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900 disabled:opacity-50"
                >
                  Enviar para aprovação
                </button>
              </section>

              {canApproveReject && (
                <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-amber-900">Aprovação / rejeição (responsável atual)</p>
                  <label className="block">
                    <span className="font-bold text-slate-700">Motivo da rejeição</span>
                    <textarea
                      className="mt-1 w-full rounded border border-slate-200 p-2 min-h-[56px]"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => postAction({ action: "reject", reason: rejectReason })}
                    disabled={loading}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-800"
                  >
                    Rejeitar e devolver
                  </button>
                  <div className="border-t border-amber-200 pt-2 mt-2 space-y-2">
                    <p className="text-[10px] text-slate-600">
                      Aprovar: deixe “Próximo (lançamentos)” vazio para apenas aprovar, ou escolha usuário para etapa de lançamentos.
                    </p>
                    <select
                      className="w-full max-w-md rounded border border-slate-200 px-2 py-1"
                      value={nextAssignee}
                      onChange={(e) => setNextAssignee(e.target.value)}
                    >
                      <option value="">Apenas aprovar (sem próximo responsável)</option>
                      {userOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => postAction({ action: "approve", nextAssignee: nextAssignee || undefined })}
                      disabled={loading}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Aprovar
                    </button>
                  </div>
                </section>
              )}

              {wfState === "APROVADO" && (
                <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-[11px] font-bold">Atribuir lançamentos</p>
                  <select
                    className="w-full max-w-md rounded border border-slate-200 px-2 py-1"
                    value={lancamentosAssignee}
                    onChange={(e) => setLancamentosAssignee(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {userOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => postAction({ action: "assign_lancamentos", assigneeUsername: lancamentosAssignee })}
                    disabled={loading || !lancamentosAssignee}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold"
                  >
                    Confirmar atribuição
                  </button>
                </section>
              )}

              {(wfState === "LANCAMENTOS" || wfState === "APROVADO") && (
                <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-[11px] font-bold">Encaminhar ao financeiro</p>
                  <select
                    className="w-full max-w-md rounded border border-slate-200 px-2 py-1"
                    value={financeAssignee}
                    onChange={(e) => setFinanceAssignee(e.target.value)}
                  >
                    <option value="">(Opcional) Responsável no financeiro</option>
                    {userOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => postAction({ action: "forward_finance", financeAssignee: financeAssignee || undefined })}
                    disabled={loading}
                    className="rounded-lg bg-indigo-700 px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    Encaminhar
                  </button>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-[11px] font-bold flex items-center gap-1">
                  <MessageSquare size={14} /> Comentário no fluxo
                </p>
                <textarea
                  className="w-full rounded border border-slate-200 p-2 min-h-[48px]"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const t = newComment.trim();
                    if (!t) return;
                    const ok = await postAction({ action: "comment", text: t });
                    if (ok) setNewComment("");
                  }}
                  disabled={loading || !newComment.trim()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold"
                >
                  Registrar comentário
                </button>
              </section>

              {(wfState === "LANCAMENTOS" || wfState === "AGUARDANDO_FINANCEIRO") &&
                canActOnWorkflow(username, role, wf?.current_assignee, wfState) && (
                  <section className="rounded-xl border border-slate-200 p-3">
                    <button
                      type="button"
                      onClick={() => postAction({ action: "mark_posted", message: "Lançamento registrado" })}
                      disabled={loading}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Marcar lançamento registrado
                    </button>
                  </section>
                )}

              <section className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 space-y-3">
                <p className="text-[11px] font-bold text-violet-900 flex items-center gap-1">
                  <Building2 size={14} /> Agências — retorno
                </p>
                <p className="text-[10px] text-slate-600">
                  Semáforo: verde quando houver nota vinculada. “Cobrar retorno” registra evento e notificação (som opcional: desative com{" "}
                  <code className="text-[10px]">localStorage sle_ocorrencias_chase_sound = &quot;0&quot;</code>).
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <select
                    className="rounded border border-slate-200 px-2 py-1 min-w-[160px]"
                    value={addAgencyId}
                    onChange={(e) => setAddAgencyId(e.target.value)}
                  >
                    <option value="">Adicionar agência…</option>
                    {agencyOptions.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.id}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="rounded border border-slate-200 px-2 py-1"
                    value={expectedBy}
                    onChange={(e) => setExpectedBy(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={addFollowup}
                    disabled={!addAgencyId}
                    className="rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    Incluir
                  </button>
                </div>
                <div className="space-y-2">
                  {followups.length === 0 ? (
                    <p className="text-[10px] text-slate-500">Nenhuma agência acompanhada.</p>
                  ) : (
                    followups.map((f: any) => {
                      const ok = !!f.response_note_id;
                      return (
                        <div
                          key={f.id}
                          className={`flex flex-col gap-2 rounded-lg border p-2 ${ok ? "border-emerald-300 bg-emerald-50/50" : "border-amber-200 bg-white"}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold">{f.agency_name || f.agency_id}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ok ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"}`}
                            >
                              {ok ? "Respondeu" : "Pendente"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <button
                              type="button"
                              onClick={() => chaseAgency(f.id)}
                              className="inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900"
                            >
                              <Bell size={12} /> Cobrar retorno
                            </button>
                            {f.chase_count ? (
                              <span className="text-[10px] text-slate-500">Cobranças: {f.chase_count}</span>
                            ) : null}
                          </div>
                          {!ok && (
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                className="rounded border border-slate-200 px-2 py-1 flex-1 min-w-[140px]"
                                value={linkNoteId[f.id] || ""}
                                onChange={(e) => setLinkNoteId((m) => ({ ...m, [f.id]: e.target.value }))}
                              >
                                <option value="">Vincular nota existente…</option>
                                {notesList.map((n: any) => (
                                  <option key={n.id} value={String(n.id)}>
                                    #{n.id} — {(n.texto || "").slice(0, 40)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => linkNote(f.id)}
                                className="rounded border border-slate-300 px-2 py-1 text-[10px] font-bold"
                              >
                                Vincular
                              </button>
                            </div>
                          )}
                          {ok && (
                            <p className="text-[10px] text-slate-600">
                              Nota #{f.response_note_id}
                              {f.responded_at ? ` · ${new Date(f.responded_at).toLocaleString("pt-BR")}` : ""}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-[11px] font-bold">Nova nota no CTE (com retorno de agência)</p>
                <select
                  className="w-full max-w-md rounded border border-slate-200 px-2 py-1"
                  value={newNoteAgencyId}
                  onChange={(e) => setNewNoteAgencyId(e.target.value)}
                >
                  <option value="">Sem vínculo de agência</option>
                  {followups.map((f: any) => (
                    <option key={f.id} value={f.agency_id}>
                      {f.agency_name || f.agency_id}
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full rounded border border-slate-200 p-2 min-h-[64px]"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Texto da nota…"
                />
                <button
                  type="button"
                  onClick={submitNewNote}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold"
                >
                  Salvar nota
                </button>
              </section>

              <section className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-[11px] font-bold">Linha do tempo do workflow</p>
                <ul className="space-y-2 max-h-[220px] overflow-y-auto">
                  {events.map((ev: any) => (
                    <li key={ev.id} className="rounded border border-slate-100 bg-slate-50/80 p-2 text-[10px]">
                      <div className="font-bold text-slate-700">
                        {ev.event_type}{" "}
                        <span className="font-normal text-slate-500">
                          · {ev.created_at ? new Date(ev.created_at).toLocaleString("pt-BR") : ""}
                        </span>
                      </div>
                      {ev.actor ? <div className="text-slate-600">Por: {ev.actor}</div> : null}
                      {ev.message ? <div className="mt-0.5">{ev.message}</div> : null}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 p-3 space-y-1">
                <p className="text-[11px] font-bold">Notas do CTE (timeline)</p>
                <ul className="space-y-1 max-h-[160px] overflow-y-auto text-[10px]">
                  {notesList.slice(0, 30).map((n: any) => (
                    <li key={n.id} className="border-b border-slate-100 pb-1">
                      <span className="text-slate-500">{n.data}</span> · <strong>{n.usuario}</strong> — {n.texto}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndemnificationModal;
