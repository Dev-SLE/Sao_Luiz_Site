'use client';

import { useState } from 'react';
import { MessageSquare, Shield, AlertTriangle, HelpCircle, Send, Lock, ChevronDown } from 'lucide-react';

const categories = [
  { id: 'reclamacao', label: 'Reclamação', icon: MessageSquare, description: 'Insatisfação com processos, condições ou atendimento' },
  { id: 'denuncia', label: 'Denúncia', icon: AlertTriangle, description: 'Relato de condutas irregulares ou antiéticas' },
  { id: 'sugestao', label: 'Sugestão', icon: HelpCircle, description: 'Ideias para melhorar processos e o ambiente de trabalho' },
  { id: 'elogio', label: 'Elogio', icon: Shield, description: 'Reconhecimento de atitudes positivas de colegas' },
];

const faqs = [
  {
    q: 'Minha identidade será protegida?',
    a: 'Sim. Todos os relatos podem ser feitos de forma anônima. Nosso sistema garante total sigilo e confidencialidade.',
  },
  {
    q: 'Qual o prazo de resposta?',
    a: 'Nos comprometemos a analisar e responder em até 5 dias úteis. Denúncias graves são tratadas com prioridade.',
  },
  {
    q: 'Quem tem acesso aos relatos?',
    a: 'Apenas o comitê de ética e a ouvidoria interna têm acesso. Gestores diretos não visualizam os registros.',
  },
  {
    q: 'Posso acompanhar meu chamado?',
    a: 'Sim. Ao enviar, você recebe um protocolo para acompanhar o andamento sem precisar se identificar.',
  },
];

export function SuportePageContent() {
  const [selected, setSelected] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-b from-sl-navy to-sl-navy/95 px-6 pb-16 pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(196,18,48,0.08),transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
            <Shield className="h-4 w-4 text-sl-red" />
            <span className="font-body text-sm text-white/80">Canal seguro e confidencial</span>
          </div>
          <h1 className="mb-4 font-heading text-4xl font-bold text-white md:text-5xl">Ouvidoria e suporte</h1>
          <p className="font-body mx-auto max-w-2xl text-lg text-white/60">
            Sua voz importa. Use este canal para reclamações, denúncias, sugestões ou elogios. Garantimos sigilo absoluto.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-20 px-6 py-16">
        <section>
          <h2 className="mb-2 font-heading text-2xl font-bold text-foreground">Como podemos ajudar?</h2>
          <p className="mb-8 font-body text-muted-foreground">Selecione o tipo de manifestação</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selected === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelected(cat.id);
                    setSent(false);
                  }}
                  className={`group rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-sl-red bg-sl-red/5 shadow-lg'
                      : 'border-border bg-card hover:border-sl-red/30 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                        isActive
                          ? 'bg-sl-red text-white'
                          : 'bg-muted text-muted-foreground group-hover:bg-sl-red/10 group-hover:text-sl-red'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-foreground">{cat.label}</h3>
                      <p className="mt-1 font-body text-sm text-muted-foreground">{cat.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selected && !sent && (
          <section className="animate-fade-in-up">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-10">
              <h2 className="mb-6 font-heading text-2xl font-bold text-foreground">
                Registrar {categories.find((c) => c.id === selected)?.label}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-sl-red" />
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">Envio anônimo</p>
                      <p className="font-body text-xs text-muted-foreground">Sua identidade não será revelada</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnonymous(!anonymous)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${anonymous ? 'bg-sl-red' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        anonymous ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {!anonymous && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-heading text-sm font-medium text-foreground">Nome</label>
                      <input
                        type="text"
                        placeholder="Seu nome completo"
                        className="h-12 w-full rounded-xl border border-border bg-background px-4 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-heading text-sm font-medium text-foreground">Setor</label>
                      <input
                        type="text"
                        placeholder="Seu setor de trabalho"
                        className="h-12 w-full rounded-xl border border-border bg-background px-4 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block font-heading text-sm font-medium text-foreground">Assunto</label>
                  <input
                    type="text"
                    required
                    placeholder="Resuma brevemente o assunto"
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-heading text-sm font-medium text-foreground">Descrição detalhada</label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Descreva com o máximo de detalhes possível..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-heading text-sm font-medium text-foreground">Anexos (opcional)</label>
                  <div className="cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-sl-red/30">
                    <p className="font-body text-sm text-muted-foreground">Arraste arquivos ou clique para selecionar</p>
                    <p className="mt-1 font-body text-xs text-muted-foreground/60">PDF, imagens ou documentos — máx. 10MB</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sl-red px-8 font-heading font-semibold text-white transition-colors hover:bg-sl-red/90 md:w-auto"
                >
                  <Send className="h-4 w-4" />
                  Enviar manifestação
                </button>
              </form>
            </div>
          </section>
        )}

        {sent && (
          <section className="animate-fade-in-up">
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <Shield className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="mb-3 font-heading text-2xl font-bold text-foreground">Manifestação registrada</h2>
              <p className="font-body mx-auto mb-4 max-w-md text-muted-foreground">
                Seu protocolo é <span className="font-semibold text-foreground">#SLE-2026-00742</span>. Use-o para acompanhar o
                andamento.
              </p>
              <p className="font-body text-sm text-muted-foreground/60">Prazo de resposta: até 5 dias úteis</p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setSelected(null);
                }}
                className="mt-8 inline-flex items-center gap-2 font-heading text-sm font-semibold text-sl-red hover:underline"
              >
                Enviar outra manifestação
              </button>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-heading text-2xl font-bold text-foreground">Perguntas frequentes</h2>
          <p className="mb-8 font-body text-muted-foreground">Tire suas dúvidas sobre o canal de ouvidoria</p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/30"
                >
                  <span className="font-heading text-sm font-semibold text-foreground">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="animate-fade-in-up px-5 pb-5">
                    <p className="font-body text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
