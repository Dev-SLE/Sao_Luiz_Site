import { ArrowRight, Star } from 'lucide-react';

const campaigns = [
  {
    id: 1,
    image: '/portal-assets/team-warehouse.jpg',
    title: 'Motorista Destaque do Mês',
    description: 'Reconhecemos os profissionais que mais se destacaram em segurança e pontualidade.',
    highlight: 'Carlos Silva — Unidade Recife',
  },
  {
    id: 2,
    title: 'Programa Bem-Estar SLE',
    description: 'Cuide da sua saúde com nossos parceiros. Descontos exclusivos em academias e nutricionistas.',
    tag: 'Em andamento',
  },
  {
    id: 3,
    title: 'Desafio Zero Acidentes',
    description: 'Cada dia sem ocorrência nos aproxima da meta. Já são 47 dias consecutivos!',
    progress: 47,
    goal: 60,
  },
];

export function CampaignsSection() {
  return (
    <section id="campanhas" className="bg-sl-navy px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red-light">Reconhecimento</p>
            <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">Campanhas e destaques</h2>
          </div>
          <a
            href="/campanhas"
            className="hidden items-center gap-2 text-sm font-medium text-sl-red-light transition-colors hover:text-white md:flex"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="group cursor-pointer md:col-span-2">
            <div className="relative aspect-[2/1] overflow-hidden rounded-2xl">
              <img
                src={campaigns[0].image}
                alt={campaigns[0].title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sl-navy via-sl-navy/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="font-heading text-sm font-semibold text-amber-400">Destaque</span>
                </div>
                <h3 className="mb-2 font-heading text-2xl font-bold text-white">{campaigns[0].title}</h3>
                <p className="mb-3 text-sm text-white/70">{campaigns[0].description}</p>
                <p className="font-heading text-sm font-semibold text-sl-red-light">{campaigns[0].highlight}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {campaigns.slice(1).map((campaign) => (
              <div
                key={campaign.id}
                className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:bg-white/10"
              >
                {campaign.tag && (
                  <span className="mb-3 inline-flex items-center rounded-full bg-sl-red/20 px-2.5 py-0.5 text-xs font-semibold text-sl-red-light">
                    {campaign.tag}
                  </span>
                )}
                <h4 className="mb-2 font-heading text-lg font-semibold text-white">{campaign.title}</h4>
                <p className="text-sm leading-relaxed text-white/60">{campaign.description}</p>
                {campaign.progress !== undefined && campaign.goal && (
                  <div className="mt-4">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-white/60">{campaign.progress} dias</span>
                      <span className="font-semibold text-sl-red-light">Meta: {campaign.goal} dias</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="gradient-red h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(campaign.progress / campaign.goal) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
