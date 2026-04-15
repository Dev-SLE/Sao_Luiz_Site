import { AlertTriangle, ArrowRight, Calendar } from 'lucide-react';

const notices = [
  {
    id: 1,
    type: 'urgent' as const,
    title: 'Manutenção programada no sistema de rastreamento',
    summary: 'O sistema ficará indisponível entre 22h e 02h neste sábado para atualização.',
    date: '10 Abr 2026',
  },
  {
    id: 2,
    type: 'important' as const,
    title: 'Novos horários de escala — Unidade São Paulo',
    summary: 'Confira as mudanças nas escalas a partir do dia 15/04.',
    date: '09 Abr 2026',
  },
  {
    id: 3,
    type: 'info' as const,
    title: 'Campanha de vacinação antigripal aberta',
    summary: 'Colaboradores podem se vacinar gratuitamente nas unidades parceiras.',
    date: '08 Abr 2026',
  },
];

export function NoticesSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Comunicação interna</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Comunicados</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Conteúdo institucional de exemplo — na Fase 2 conectamos aos dados reais do RH/comunicação.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {notices.map((n) => (
            <article
              key={n.id}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-lg"
            >
              <div className="mb-3 flex items-center gap-2">
                {n.type === 'urgent' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <span className="text-xs font-semibold uppercase text-sl-red">{n.type}</span>
              </div>
              <h3 className="font-heading text-base font-bold text-foreground">{n.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{n.summary}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {n.date}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a
            href="/comunicados"
            className="inline-flex items-center gap-2 text-sm font-medium text-sl-red hover:text-sl-red-light"
          >
            Ver área de comunicados <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
