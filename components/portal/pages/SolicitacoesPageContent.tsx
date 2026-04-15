'use client';

import { useState } from 'react';
import { ClipboardList, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const mock = [
  { id: 'REQ-2401', title: 'Substituição de EPI — colete refletivo', status: 'em_analise' as const, date: '12/04/2026' },
  { id: 'REQ-2398', title: 'Ajuste de escala — semana 14–18/04', status: 'aprovada' as const, date: '10/04/2026' },
  { id: 'REQ-2392', title: 'Declaração de vínculo para financiamento', status: 'pendente_docs' as const, date: '08/04/2026' },
];

const statusLabel: Record<(typeof mock)[number]['status'], { text: string; className: string; icon: typeof Clock }> = {
  em_analise: { text: 'Em análise', className: 'bg-amber-500/10 text-amber-700', icon: Clock },
  aprovada: { text: 'Aprovada', className: 'bg-emerald-500/10 text-emerald-700', icon: CheckCircle2 },
  pendente_docs: { text: 'Aguardando documentos', className: 'bg-sl-red/10 text-sl-red', icon: AlertCircle },
};

export function SolicitacoesPageContent() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-sl-navy to-sl-navy/90 px-6 pb-14 pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
            <ClipboardList className="h-4 w-4 text-sl-red" />
            <span>Fluxos internos (integração RH na Fase 2)</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">Solicitações internas</h1>
          <p className="mt-3 font-body text-white/60">
            Acompanhe pedidos administrativos e abra novas solicitações. Os dados abaixo são de demonstração.
          </p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
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
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Abrir solicitação (demo)</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Na integração com DP/RH, este formulário enviará o fluxo oficial. Por enquanto, apenas simulação de UI.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tipo (ex.: benefício, documento, escala)"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Descreva o pedido"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-sl-navy px-4 py-2 text-sm font-medium text-white"
              >
                Registrar (demo)
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {mock.map((row) => {
            const s = statusLabel[row.status];
            const Icon = s.icon;
            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-heading text-sm font-semibold text-foreground">{row.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.id} · aberta em {row.date}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.className}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
