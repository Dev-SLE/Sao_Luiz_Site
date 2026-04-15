import { ArrowRight } from 'lucide-react';

const featured = {
  id: 1,
  image: '/portal-assets/team-warehouse.jpg',
  category: 'Institucional',
  title: 'São Luiz Express completa 25 anos conectando o Brasil',
  summary:
    'Uma trajetória de compromisso com a excelência logística e o cuidado com as pessoas que fazem tudo acontecer.',
  date: '10 Abr 2026',
};

const posts = [
  {
    id: 2,
    image: '/portal-assets/operations-center.jpg',
    category: 'Operações',
    title: 'Nova central de monitoramento já está em operação',
    summary: 'Centro de controle permite acompanhamento em tempo real de toda a frota.',
    date: '09 Abr 2026',
  },
  {
    id: 3,
    category: 'RH',
    title: 'Programa de desenvolvimento de líderes abre inscrições',
    summary: 'Capacitação exclusiva para gestores com módulos presenciais e online.',
    date: '08 Abr 2026',
  },
  {
    id: 4,
    category: 'Segurança',
    title: 'Semana interna de prevenção de acidentes — SIPAT 2026',
    summary: 'Confira a programação completa e participe das atividades.',
    date: '07 Abr 2026',
  },
];

export function CommunicationsSection() {
  return (
    <section id="comunicados" className="bg-secondary/50 px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Fique por dentro</p>
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Comunicados recentes</h2>
          </div>
          <a
            href="/comunicados"
            className="hidden items-center gap-2 text-sm font-medium text-sl-red transition-colors hover:text-sl-red-light md:flex"
          >
            Ver todos <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <article className="group cursor-pointer">
            <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-2xl">
              <img
                src={featured.image}
                alt={featured.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sl-navy/70 to-transparent" />
              <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                {featured.category}
              </span>
            </div>
            <time className="text-xs text-muted-foreground">{featured.date}</time>
            <h3 className="mt-2 font-heading text-2xl font-bold leading-tight text-foreground transition-colors group-hover:text-sl-navy-light">
              {featured.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{featured.summary}</p>
          </article>

          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.id}
                className="group flex cursor-pointer gap-5 rounded-xl p-4 transition-colors duration-200 hover:bg-card"
              >
                {post.image && (
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-sl-red">{post.category}</span>
                    <span className="text-xs text-muted-foreground">· {post.date}</span>
                  </div>
                  <h4 className="font-heading text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sl-navy-light">
                    {post.title}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
