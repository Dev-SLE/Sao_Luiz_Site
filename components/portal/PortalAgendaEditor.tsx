'use client';

import { useCallback, useEffect, useState } from 'react';
import { canEditPortalContent } from '@/lib/portalEditorAccess';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';

type AgendaRow = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  metadata: {
    timeRange?: string | null;
    location?: string | null;
    eventType?: string;
    color?: string;
  } | null;
  published_at: string;
};

const EVENT_TYPES = [
  { value: 'event', label: 'Evento' },
  { value: 'deadline', label: 'Prazo' },
  { value: 'training', label: 'Treinamento' },
  { value: 'social', label: 'Social' },
  { value: 'maintenance', label: 'Manutenção' },
];

const COLORS = [
  { value: 'border-l-sl-red', label: 'Vermelho' },
  { value: 'border-l-amber-500', label: 'Âmbar' },
  { value: 'border-l-blue-500', label: 'Azul' },
  { value: 'border-l-emerald-500', label: 'Verde' },
  { value: 'border-l-orange-500', label: 'Laranja' },
];

const emptyForm = {
  title: '',
  body: '',
  href: '',
  eventDate: '',
  timeRange: '',
  location: '',
  eventType: 'event',
  color: 'border-l-sl-red',
};

export function PortalAgendaEditor() {
  const { user } = useAuth();
  const { hasPermission } = useData();
  const allowed = canEditPortalContent(hasPermission, { role: user?.role });
  const [items, setItems] = useState<AgendaRow[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/agenda', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao listar agenda');
      setItems((data.items || []) as AgendaRow[]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed && hasPermission('portal.agenda.view')) void load();
  }, [allowed, hasPermission, load]);

  function startEdit(row: AgendaRow) {
    setEditingId(row.id);
    const d = row.published_at ? new Date(row.published_at) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const meta = row.metadata || {};
    setForm({
      title: row.title,
      body: row.body || '',
      href: row.href || '',
      eventDate: `${y}-${m}-${day}`,
      timeRange: String(meta.timeRange || ''),
      location: String(meta.location || ''),
      eventType: String(meta.eventType || 'event'),
      color: String(meta.color || 'border-l-sl-red'),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submitCreate() {
    if (!editingId) {
      setMsg('');
      try {
        const res = await fetch('/api/portal/agenda', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title.trim(),
            body: form.body.trim() || null,
            href: form.href.trim() || null,
            eventDate: form.eventDate,
            timeRange: form.timeRange.trim() || null,
            location: form.location.trim() || null,
            eventType: form.eventType,
            color: form.color,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Falha ao criar');
        resetForm();
        await load();
        setMsg('Evento criado.');
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'Erro');
      }
      return;
    }

    setMsg('');
    try {
      const res = await fetch(`/api/portal/agenda/${editingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim() || null,
          href: form.href.trim() || null,
          eventDate: form.eventDate,
          timeRange: form.timeRange.trim() || null,
          location: form.location.trim() || null,
          eventType: form.eventType,
          color: form.color,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar');
      resetForm();
      await load();
      setMsg('Evento atualizado.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function remove(id: string) {
    if (!globalThis.confirm('Remover este evento da agenda?')) return;
    setMsg('');
    try {
      const res = await fetch(`/api/portal/agenda/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao excluir');
      if (editingId === id) resetForm();
      await load();
      setMsg('Removido.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem permissão de edição. É necessário <code className="rounded bg-muted px-1 text-xs">portal.colaborador.editor</code>.
      </p>
    );
  }

  if (!hasPermission('portal.agenda.view')) {
    return <p className="text-sm text-muted-foreground">Sem permissão para ver a agenda (portal.agenda.view).</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-sl-red">Agenda corporativa</p>
        <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">Eventos visíveis em /agenda</h2>
        <p className="mt-2 text-sm text-muted-foreground">Os colaboradores veem a lista na página Agenda. Datas e textos ficam no banco (sem SharePoint).</p>
      </div>

      {msg ? <p className="text-sm text-sl-navy">{msg}</p> : null}

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <p className="text-xs font-bold uppercase text-muted-foreground">{editingId ? 'Editar evento' : 'Novo evento'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground">Título</label>
            <input
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Data do evento</label>
            <input
              type="date"
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.eventDate}
              onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Horário / faixa</label>
            <input
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              placeholder="ex: 09:00 - 12:00"
              value={form.timeRange}
              onChange={(e) => setForm((f) => ({ ...f, timeRange: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground">Local</label>
            <input
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Tipo</label>
            <select
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.eventType}
              onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Cor (borda na lista)</label>
            <select
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            >
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground">Descrição</label>
            <textarea
              className="mt-0.5 min-h-[80px] w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground">Link opcional</label>
            <input
              className="mt-0.5 w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={form.href}
              onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submitCreate()}
            className="rounded-lg bg-sl-red px-4 py-2 text-sm font-semibold text-white hover:bg-sl-red-light"
          >
            {editingId ? 'Salvar alterações' : 'Publicar evento'}
          </button>
          {editingId ? (
            <button type="button" onClick={() => resetForm()} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancelar edição
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="bg-muted px-4 py-2 text-xs font-bold uppercase">Eventos ({items.length})</div>
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const d = it.published_at ? new Date(it.published_at) : null;
              const when = d
                ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—';
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{when}</span>
                  <span className="font-medium text-foreground flex-1 min-w-[160px]">{it.title}</span>
                  <button type="button" className="text-xs text-sl-navy underline" onClick={() => startEdit(it)}>
                    Editar
                  </button>
                  <button type="button" className="text-xs text-red-600 underline" onClick={() => void remove(it.id)}>
                    Excluir
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
