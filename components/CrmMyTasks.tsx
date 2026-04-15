import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ListTodo, Trash2 } from 'lucide-react';
import { authClient } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import clsx from 'clsx';

const CrmMyTasks: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = useData();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const [seeAll, setSeeAll] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');

  const canManageAll = hasPermission('MANAGE_CRM_OPS') || hasPermission('MANAGE_SETTINGS');

  const load = async () => {
    setLoading(true);
    try {
      const r = await authClient.getCrmTasks({
        status: statusFilter === 'OPEN' ? 'OPEN' : 'ALL',
        all: seeAll && canManageAll,
      });
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter, seeAll, canManageAll]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-slate-900 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-sl-red border border-slate-200">
          <ListTodo size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Minhas pendências</h1>
          <p className="text-xs text-slate-600">
            Tarefas de follow-up humano ligadas ao CRM. Visíveis para você ou para toda operação (gestores).
          </p>
        </div>
      </div>

      <div className="surface-card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Nova tarefa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none md:col-span-2"
            placeholder="O que fazer?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <textarea
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 min-h-[64px] md:col-span-2"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={!title.trim()}
          className="rounded-lg bg-sl-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-sl-red"
          onClick={async () => {
            await authClient.saveCrmTask({
              action: 'CREATE',
              title: title.trim(),
              dueAt: dueAt ? new Date(dueAt).toISOString() : null,
              notes: notes.trim() || null,
              assignedUsername: user?.username || undefined,
            });
            setTitle('');
            setDueAt('');
            setNotes('');
            await load();
          }}
        >
          Salvar para mim ({user?.username || '…'})
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'OPEN' | 'ALL')}
        >
          <option value="OPEN">Abertas</option>
          <option value="ALL">Todas</option>
        </select>
        {canManageAll && (
          <label className="inline-flex items-center gap-1 text-slate-700">
            <input type="checkbox" checked={seeAll} onChange={(e) => setSeeAll(e.target.checked)} />
            Ver toda operação
          </label>
        )}
        <button type="button" className="text-sl-navy font-semibold hover:underline" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <div className="surface-card p-0 divide-y divide-slate-200 overflow-hidden">
        {loading && <div className="p-4 text-xs text-slate-500">Carregando…</div>}
        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">Nenhuma tarefa neste filtro.</div>
        )}
        {!loading &&
          items.map((t) => {
            const open = String(t.status || '').toUpperCase() === 'OPEN';
            const due = t.due_at ? new Date(t.due_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
            return (
              <div key={t.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex gap-2">
                  {open ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                  <div className="min-w-0">
                    <p className={clsx('text-sm font-bold', open ? 'text-slate-900' : 'text-slate-500 line-through')}>{t.title}</p>
                    <p className="text-[11px] text-slate-500">
                      Responsável: {t.assigned_username || '—'} · Vence: {due}
                      {t.lead_title ? ` · Lead: ${t.lead_title}` : ''}
                      {t.lead_protocol ? ` · ${t.lead_protocol}` : ''}
                    </p>
                    {t.notes ? <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{t.notes}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {open && (
                    <button
                      type="button"
                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                      onClick={async () => {
                        await authClient.saveCrmTask({ action: 'UPDATE', id: t.id, status: 'DONE' });
                        await load();
                      }}
                    >
                      Concluir
                    </button>
                  )}
                  {!open && (
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                      onClick={async () => {
                        await authClient.saveCrmTask({ action: 'UPDATE', id: t.id, status: 'OPEN' });
                        await load();
                      }}
                    >
                      Reabrir
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded border border-red-100 bg-red-50 p-1 text-red-700"
                    title="Excluir"
                    onClick={async () => {
                      if (!window.confirm('Excluir esta tarefa?')) return;
                      await authClient.saveCrmTask({ action: 'DELETE', id: t.id });
                      await load();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default CrmMyTasks;
