'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, Clock } from 'lucide-react';

type Row = {
  id: string;
  created_at: string;
  status: string;
  payload: { tipo?: string; descricao?: string };
};

const statusLabel: Record<string, { text: string; className: string }> = {
  received: { text: 'Recebida', className: 'bg-slate-500/10 text-slate-700' },
  em_analise: { text: 'Em análise', className: 'bg-amber-500/10 text-amber-700' },
  aprovada: { text: 'Aprovada', className: 'bg-emerald-500/10 text-emerald-700' },
  pendente_docs: { text: 'Aguardando documentos', className: 'bg-sl-red/10 text-sl-red' },
};

export function SolicitacoesPageContent() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/solicitacoes', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setItems((data.items || []) as Row[]);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setError(null);
    if (!tipo.trim() || !descricao.trim()) {
      setError('Preencha tipo e descrição.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/portal/solicitacoes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipo.trim(), descricao: descricao.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao registrar');
      setTipo('');
      setDescricao('');
      setOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-sl-navy to-sl-navy/90 px-6 pb-14 pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
            <ClipboardList className="h-4 w-4 text-sl-red" />
            <span>Solicitações internas</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">Solicitações internas</h1>
          <p className="mt-3 font-body text-white/60">
            Registre pedidos administrativos; eles ficam vinculados ao seu usuário e aparecem na lista abaixo.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              setError(null);
            }}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-sl-red px-6 py-3 font-heading text-sm font-semibold text-white transition-colors hover:bg-sl-red/90"
          >
            <Plus className="h-4 w-4" />
            Nova solicitação
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        {open && (
          <div className="animate-fade-in-up rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Abrir solicitação</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              O registro é salvo no banco. Fluxos de aprovação com RH podem ser acoplados depois sem perder o histórico.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Tipo (ex.: benefício, documento, escala)"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
              <textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o pedido"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="rounded-lg bg-sl-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Registrando…' : 'Registrar solicitação'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {!loaded && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {loaded && items.length === 0 && !open && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
            Nenhuma solicitação registrada ainda.
          </div>
        )}

        <div className="space-y-3">
          {items.map((row) => {
            const tipoText = row.payload?.tipo || 'Solicitação';
            const desc = row.payload?.descricao || '';
            const st = statusLabel[row.status] || statusLabel.received;
            const dateStr = row.created_at
              ? new Date(row.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : '';
            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-semibold text-foreground">{tipoText}</p>
                  {desc ? <p className="mt-2 text-sm text-muted-foreground">{desc}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {row.id.slice(0, 8).toUpperCase()}… · {dateStr}
                  </p>
                </div>
                <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${st.className}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {st.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
