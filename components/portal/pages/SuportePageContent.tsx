'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Shield, AlertTriangle, HelpCircle, Send, Lock, ChevronDown } from 'lucide-react';

const categories = [
  { id: 'reclamacao', label: 'Reclamação', icon: MessageSquare, description: 'Insatisfação com processos, condições ou atendimento' },
  { id: 'denuncia', label: 'Denúncia', icon: AlertTriangle, description: 'Relato de condutas irregulares ou antiéticas' },
  { id: 'sugestao', label: 'Sugestão', icon: HelpCircle, description: 'Ideias para melhorar processos e o ambiente de trabalho' },
  { id: 'elogio', label: 'Elogio', icon: Shield, description: 'Reconhecimento de atitudes positivas de colegas' },
];

type FaqItem = { id: string; title: string; description?: string | null };

export function SuportePageContent() {
  const [selected, setSelected] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [protocolShort, setProtocolShort] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqsLoaded, setFaqsLoaded] = useState(false);

  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=faq', { credentials: 'include' });
        if (!res.ok) {
          if (!c) setFaqsLoaded(true);
          return;
        }
        const data = await res.json();
        if (!c) {
          setFaqs((data.items || []) as FaqItem[]);
          setFaqsLoaded(true);
        }
      } catch {
        if (!c) setFaqsLoaded(true);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/ouvidoria', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestationType: selected,
          anonymous,
          name: anonymous ? undefined : name,
          sector: anonymous ? undefined : sector,
          subject,
          description,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao enviar');
      setProtocol(String(data.protocol || ''));
      setProtocolShort(String(data.protocolShort || ''));
      setSent(true);
      setSubject('');
      setDescription('');
      setName('');
      setSector('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
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
            Sua voz importa. Use este canal para reclamações, denúncias, sugestões ou elogios. As manifestações são registradas no sistema com protocolo real.
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
                    setSubmitError(null);
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

              <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-6">
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
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome completo"
                        className="h-12 w-full rounded-xl border border-border bg-background px-4 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-heading text-sm font-medium text-foreground">Setor</label>
                      <input
                        type="text"
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
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
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Resuma brevemente o assunto"
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-heading text-sm font-medium text-foreground">Descrição detalhada</label>
                  <textarea
                    required
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva com o máximo de detalhes possível..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 font-body text-sm placeholder:text-muted-foreground transition-colors focus:border-sl-red focus:outline-none focus:ring-2 focus:ring-sl-red/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-heading text-sm font-medium text-foreground">Anexos (opcional)</label>
                  <div className="cursor-not-allowed rounded-xl border-2 border-dashed border-border p-6 text-center opacity-60">
                    <p className="font-body text-sm text-muted-foreground">Envio de arquivos será habilitado em versão futura.</p>
                  </div>
                </div>

                {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sl-red px-8 font-heading font-semibold text-white transition-colors hover:bg-sl-red/90 disabled:opacity-60 md:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Enviando…' : 'Enviar manifestação'}
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
              <p className="font-body mx-auto mb-2 max-w-md text-muted-foreground">
                Guarde o protocolo: <span className="font-mono font-semibold text-foreground">{protocolShort || protocol}</span>
              </p>
              {protocol ? (
                <p className="font-body mx-auto mb-4 max-w-lg text-xs text-muted-foreground/80">Referência completa: {protocol}</p>
              ) : null}
              <p className="font-body text-sm text-muted-foreground/60">A ouvidoria dará seguimento conforme política interna.</p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setSelected(null);
                  setProtocol(null);
                  setProtocolShort(null);
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
          <p className="mb-8 font-body text-muted-foreground">
            Conteúdo editável no gestor (tipo <span className="font-mono text-xs">faq</span> em /portal-edicao): título = pergunta, texto = resposta.
          </p>
          {!faqsLoaded && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {faqsLoaded && faqs.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhuma FAQ publicada.
              <Link href="/portal-edicao" className="mt-2 block font-medium text-sl-red hover:text-sl-red-light">
                Cadastrar FAQs
              </Link>
            </div>
          )}
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.id} className="overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/30"
                >
                  <span className="font-heading text-sm font-semibold text-foreground">{faq.title}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openFaqId === faq.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaqId === faq.id && (
                  <div className="animate-fade-in-up px-5 pb-5">
                    <p className="font-body text-sm text-muted-foreground whitespace-pre-wrap">
                      {(faq.description || '').trim() || '—'}
                    </p>
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
