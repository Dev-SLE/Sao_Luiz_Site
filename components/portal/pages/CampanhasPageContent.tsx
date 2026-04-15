'use client';

import { Star, Trophy, Users } from 'lucide-react';

const spotlightPerson = {
  name: 'Carlos Eduardo Silva',
  role: 'Motorista — Unidade Recife',
  image: '/portal-assets/driver-portrait.jpg',
  quote: 'Cada entrega é uma missão. Segurança sempre em primeiro lugar.',
  achievement: 'Motorista Destaque — 3 meses consecutivos',
};

const campaigns = [
  {
    id: 1,
    title: 'Desafio Zero Acidentes',
    description: 'Cada unidade compete pela marca de dias sem ocorrências. A segurança é responsabilidade de todos.',
    image: '/portal-assets/hero-trucks.jpg',
    progress: 47,
    goal: 60,
    metric: 'dias sem acidentes',
    participants: 342,
  },
  {
    id: 2,
    title: 'Programa Bem-Estar SLE',
    description: 'Cuidar de quem cuida das entregas. Descontos em academias, nutricionistas e apoio psicológico.',
    image: '/portal-assets/team-warehouse.jpg',
    tag: 'Em andamento',
    participants: 189,
  },
];

const recognitions = [
  { id: 1, name: 'Ana Beatriz Souza', unit: 'São Paulo', badge: 'Colaboradora do Mês', avatar: 'AS' },
  { id: 2, name: 'Roberto Lima', unit: 'Recife', badge: '100 Entregas Perfeitas', avatar: 'RL' },
  { id: 3, name: 'Fernanda Costa', unit: 'Matriz', badge: 'Inovação Operacional', avatar: 'FC' },
  { id: 4, name: 'João Marcos', unit: 'Salvador', badge: 'Segurança Nota 10', avatar: 'JM' },
  { id: 5, name: 'Patrícia Oliveira', unit: 'Belo Horizonte', badge: 'Líder Inspirador', avatar: 'PO' },
  { id: 6, name: 'Diego Ferreira', unit: 'Curitiba', badge: 'Pontualidade Exemplar', avatar: 'DF' },
];

export function CampanhasPageContent() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pt-16">
        <div className="relative flex min-h-[60vh] items-center overflow-hidden bg-sl-navy">
          <div className="absolute inset-0 opacity-20">
            <img src="/portal-assets/hero-trucks.jpg" alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-sl-navy via-sl-navy/95 to-sl-navy/70" />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20">
            <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
              <div>
                <div className="mb-6 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="font-heading text-sm font-semibold uppercase tracking-widest text-amber-400">
                    Destaque do mês
                  </span>
                </div>
                <h1 className="mb-4 font-heading text-4xl font-bold leading-tight text-white md:text-5xl">
                  {spotlightPerson.name}
                </h1>
                <p className="mb-2 text-lg text-white/60">{spotlightPerson.role}</p>
                <p className="mb-6 font-heading text-sm font-semibold text-sl-red-light">{spotlightPerson.achievement}</p>
                <blockquote className="max-w-md border-l-2 border-sl-red pl-4 text-lg italic text-white/80">
                  &ldquo;{spotlightPerson.quote}&rdquo;
                </blockquote>
              </div>
              <div className="flex justify-center md:justify-end">
                <div className="h-72 w-72 overflow-hidden rounded-3xl border-4 border-white/10 shadow-2xl md:h-80 md:w-80">
                  <img src={spotlightPerson.image} alt={spotlightPerson.name} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Campanhas ativas</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Faça parte da mudança</h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl"
            >
              <div className="relative aspect-[2/1] overflow-hidden">
                <img
                  src={campaign.image}
                  alt={campaign.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-sl-navy/70 to-transparent" />
                {'tag' in campaign && campaign.tag && (
                  <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                    {campaign.tag}
                  </span>
                )}
              </div>
              <div className="p-6">
                <h3 className="mb-2 font-heading text-xl font-bold text-foreground transition-colors group-hover:text-sl-navy-light">
                  {campaign.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{campaign.description}</p>

                {'progress' in campaign && campaign.progress !== undefined && 'goal' in campaign && (
                  <div className="mb-4">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {campaign.progress} {campaign.metric}
                      </span>
                      <span className="font-semibold text-sl-red">Meta: {campaign.goal}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="gradient-red h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(campaign.progress / campaign.goal) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{campaign.participants} participantes</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="bg-secondary/50 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">
              Mural de reconhecimento
            </p>
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Quem faz a diferença</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recognitions.map((person, index) => (
              <div
                key={person.id}
                className="flex animate-fade-in-up items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-sl-navy">
                  <span className="font-heading text-sm font-bold text-white">{person.avatar}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-semibold text-foreground">{person.name}</p>
                  <p className="text-xs text-muted-foreground">{person.unit}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-amber-600">{person.badge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
