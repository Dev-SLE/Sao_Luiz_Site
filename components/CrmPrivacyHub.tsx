import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { authClient } from '../lib/auth';

const CrmPrivacyHub: React.FC = () => {
  const [prefs, setPrefs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    phone: '',
    email: '',
    allowWhatsapp: true,
    allowCampaigns: true,
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await authClient.getCrmConsentAdmin({ limit: 150 });
      setPrefs(Array.isArray(r.prefs) ? r.prefs : []);
      setEvents(Array.isArray(r.events) ? r.events : []);
    } catch {
      setPrefs([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-slate-900 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-sl-navy border border-slate-200">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black leading-tight">Privacidade & consentimento</h1>
            <p className="text-xs text-slate-600">
              Preferências de marketing, trilha de eventos e ajustes manuais. Acesso restrito a gestores.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
          onClick={() => void load()}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      <div className="surface-card p-4 space-y-2">
        <h2 className="text-sm font-bold">Ajustar preferências</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-xs"
            placeholder="Telefone (últimos 10 dígitos serão usados)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-xs"
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-[11px]">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.allowWhatsapp}
              onChange={(e) => setForm((f) => ({ ...f, allowWhatsapp: e.target.checked }))}
            />
            WhatsApp marketing
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.allowCampaigns}
              onChange={(e) => setForm((f) => ({ ...f, allowCampaigns: e.target.checked }))}
            />
            Campanhas em massa
          </label>
        </div>
        <textarea
          className="w-full min-h-[48px] rounded border border-slate-300 px-2 py-1 text-xs"
          placeholder="Nota interna (opcional)"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
        <button
          type="button"
          className="rounded-lg bg-sl-navy px-4 py-2 text-xs font-bold text-white"
          onClick={async () => {
            if (!form.phone.trim() && !form.email.trim()) {
              window.alert('Informe telefone ou e-mail.');
              return;
            }
            await authClient.postCrmConsent({
              action: 'UPSERT_PREFS',
              phone: form.phone.trim() || undefined,
              email: form.email.trim() || undefined,
              allowWhatsappMarketing: form.allowWhatsapp,
              allowCampaigns: form.allowCampaigns,
              notes: form.notes.trim() || null,
            });
            await load();
          }}
        >
          Salvar preferências
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="surface-card p-4 max-h-[420px] overflow-y-auto">
            <h2 className="text-sm font-bold mb-2">Preferências recentes</h2>
            <ul className="text-[10px] space-y-2">
              {prefs.map((p) => (
                <li key={p.id} className="border-b border-slate-100 pb-2">
                  <span className="font-mono">{p.phone_last10 || p.email_normalized || '—'}</span>
                  <span className="text-slate-500">
                    {' '}
                    · camp: {p.allow_campaigns ? 'sim' : 'não'} · zap: {p.allow_whatsapp_marketing ? 'sim' : 'não'}
                  </span>
                  <p className="text-slate-500">{p.updated_by} · {p.updated_at && new Date(p.updated_at).toLocaleString('pt-BR')}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-card p-4 max-h-[420px] overflow-y-auto">
            <h2 className="text-sm font-bold mb-2">Trilha de eventos</h2>
            <ul className="text-[10px] space-y-2">
              {events.map((e) => (
                <li key={e.id} className="border-b border-slate-100 pb-2">
                  <span className="font-bold">{e.event_type}</span>{' '}
                  <span className="text-slate-500">
                    {e.actor_username} · {e.created_at && new Date(e.created_at).toLocaleString('pt-BR')}
                  </span>
                  <p className="text-slate-600">{e.phone_last10 || e.email_normalized || e.lead_id || '—'}</p>
                  {e.reason && <p className="text-slate-500">{e.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmPrivacyHub;
