import React, { useState } from 'react';
import { Search, UserCircle2, MessageSquare, ListChecks, ShieldAlert } from 'lucide-react';
import { authClient } from '../lib/auth';
import clsx from 'clsx';

const CrmContact360: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [leadId, setLeadId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [optReason, setOptReason] = useState('');

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await authClient.getCrmContact360({
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        leadId: leadId.trim() || undefined,
      });
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const primaryLeadId = data?.leads?.[0]?.id as string | undefined;

  const recordOptOut = async () => {
    if (!primaryLeadId) return;
    try {
      await authClient.postCrmConsent({
        action: 'RECORD_EVENT',
        eventType: 'OPT_OUT',
        leadId: primaryLeadId,
        reason: optReason.trim() || 'Solicitação registrada pelo atendente',
      });
      setOptReason('');
      await runSearch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao registrar opt-out');
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-slate-900 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-sl-navy border border-slate-200">
          <UserCircle2 size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Contato 360</h1>
          <p className="text-xs text-slate-600">
            Visão unificada por telefone, e-mail ou ID do lead. Respeita o mesmo escopo do chat (self / time / global).
          </p>
        </div>
      </div>

      <div className="surface-card p-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          placeholder="Telefone (qualquer formato)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          placeholder="UUID do lead"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        />
        <button
          type="button"
          disabled={loading || (!phone.trim() && !email.trim() && !leadId.trim())}
          className="rounded-lg bg-sl-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={() => void runSearch()}
        >
          <Search size={14} />
          Buscar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
      )}

      {loading && <p className="text-xs text-slate-500">Carregando…</p>}

      {data && !loading && (
        <>
          {(!data.leads || data.leads.length === 0) && (
            <p className="text-sm text-slate-600">Nenhum lead visível para você com esses critérios.</p>
          )}

          {data.leads?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="surface-card p-4 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <MessageSquare size={16} />
                  Leads
                </h2>
                <ul className="space-y-2 text-[11px]">
                  {data.leads.map((l: any) => (
                    <li key={l.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="font-bold text-slate-900">{l.title}</p>
                      <p className="text-slate-600">
                        {l.contact_phone || '—'} · {l.contact_email || '—'}
                      </p>
                      <p className="text-slate-500">
                        Estágio: {l.stage_name || '—'} · Protocolo: {l.protocol_number || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="surface-card p-4 space-y-3 border border-amber-100 bg-amber-50/30">
                <h2 className="text-sm font-bold flex items-center gap-2 text-amber-950">
                  <ShieldAlert size={16} />
                  Privacidade (opt-out)
                </h2>
                <p className="text-[11px] text-slate-600">
                  Registra evento auditável e bloqueia campanhas para este telefone (últimos 10 dígitos) / e-mail quando
                  aplicável.
                </p>
                <textarea
                  className="w-full min-h-[56px] rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  placeholder="Motivo (opcional)"
                  value={optReason}
                  onChange={(e) => setOptReason(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!primaryLeadId}
                  className="rounded-lg bg-amber-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  onClick={() => void recordOptOut()}
                >
                  Registrar opt-out do cliente
                </button>
                {data.prefs && (
                  <div className="text-[11px] text-slate-700 rounded border border-slate-200 bg-white p-2">
                    <p>
                      <strong>Preferências salvas:</strong> campanhas{' '}
                      {data.prefs.allow_campaigns ? 'permitidas' : 'bloqueadas'} · WhatsApp marketing{' '}
                      {data.prefs.allow_whatsapp_marketing ? 'permitido' : 'bloqueado'}
                    </p>
                    <p className="text-slate-500">Atualizado por {data.prefs.updated_by || '—'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {data.conversations?.length > 0 && (
            <div className="surface-card p-4">
              <h2 className="text-sm font-bold mb-2">Conversas</h2>
              <div className="overflow-x-auto text-[11px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="py-1 pr-2">Canal</th>
                      <th className="py-1 pr-2">Status</th>
                      <th className="py-1 pr-2">Responsável</th>
                      <th className="py-1">Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.conversations.map((c: any) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="py-1 pr-2">{c.channel}</td>
                        <td className="py-1 pr-2">{c.status}</td>
                        <td className="py-1 pr-2">{c.assigned_username || '—'}</td>
                        <td className="py-1 font-mono text-[10px]">{c.lead_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.tasks?.length > 0 && (
            <div className="surface-card p-4">
              <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
                <ListChecks size={16} />
                Tarefas
              </h2>
              <ul className="text-[11px] space-y-1">
                {data.tasks.map((t: any) => (
                  <li key={t.id} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                    <span>{t.title}</span>
                    <span className={clsx('shrink-0', t.status === 'OPEN' ? 'text-amber-700' : 'text-slate-500')}>
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.timeline?.length > 0 && (
            <div className="surface-card p-4">
              <h2 className="text-sm font-bold mb-2">Linha do tempo (mensagens recentes)</h2>
              <div className="max-h-80 overflow-y-auto space-y-2 text-[11px]">
                {data.timeline.map((m: any) => (
                  <div key={m.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>
                        {m.sender_type} · {new Date(m.created_at).toLocaleString('pt-BR')}
                      </span>
                      <span className="font-mono">{String(m.lead_id).slice(0, 8)}…</span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-wrap">{m.body || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.consentEvents?.length > 0 && (
            <div className="surface-card p-4">
              <h2 className="text-sm font-bold mb-2">Eventos de consentimento (visíveis no escopo)</h2>
              <ul className="text-[10px] text-slate-600 space-y-1">
                {data.consentEvents.map((e: any) => (
                  <li key={e.id}>
                    {e.event_type} · {e.actor_username || '—'} ·{' '}
                    {e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : ''}
                    {e.reason ? ` — ${e.reason}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CrmContact360;
