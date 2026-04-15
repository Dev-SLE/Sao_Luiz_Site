'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Search } from 'lucide-react';

const categories = ['Todos', 'Institucional', 'Operações', 'RH', 'Segurança', 'TI'];

const allPosts = [
  {
    id: 1,
    image: '/portal-assets/team-warehouse.jpg',
    category: 'Institucional',
    title: 'São Luiz Express completa 25 anos conectando o Brasil',
    summary: 'Uma trajetória de compromisso com a excelência logística e o cuidado com as pessoas que fazem tudo acontecer.',
    date: '10 Abr 2026',
    featured: true,
  },
  {
    id: 2,
    image: '/portal-assets/operations-center.jpg',
    category: 'Operações',
    title: 'Nova central de monitoramento já está em operação',
    summary: 'Centro de controle permite acompanhamento em tempo real de toda a frota nacional.',
    date: '09 Abr 2026',
    featured: true,
  },
  {
    id: 3,
    category: 'RH',
    title: 'Programa de desenvolvimento de líderes abre inscrições',
    summary: 'Capacitação exclusiva para gestores com módulos presenciais e online. As vagas são limitadas.',
    date: '08 Abr 2026',
  },
  {
    id: 4,
    category: 'Segurança',
    title: 'SIPAT 2026 — Confira a programação completa',
    summary: 'A Semana Interna de Prevenção de Acidentes traz palestras, atividades e premiações.',
    date: '07 Abr 2026',
  },
  {
    id: 5,
    image: '/portal-assets/hero-trucks.jpg',
    category: 'Operações',
    title: 'Frota renovada: 30 novos veículos chegam às unidades',
    summary: 'Investimento reforça compromisso com segurança e eficiência nas entregas.',
    date: '06 Abr 2026',
  },
  {
    id: 6,
    category: 'RH',
    title: 'Campanha de vacinação antigripal — locais e datas',
    summary: 'Colaboradores podem se vacinar gratuitamente em qualquer unidade parceira.',
    date: '05 Abr 2026',
  },
  {
    id: 7,
    category: 'TI',
    title: 'Novo sistema de rastreamento entra em fase de testes',
    summary: 'Plataforma moderna substituirá o sistema atual com funcionalidades avançadas.',
    date: '04 Abr 2026',
  },
  {
    id: 8,
    category: 'Institucional',
    title: 'São Luiz Express é reconhecida como uma das melhores empresas para trabalhar',
    summary: 'Pesquisa GPTW coloca a empresa entre as top 50 do setor de logística.',
    date: '03 Abr 2026',
  },
];

type Post = {
  id: string | number;
  category: string;
  title: string;
  summary: string;
  date: string;
  featured?: boolean;
  image?: string;
};

export function ComunicadosPageContent() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromApi, setFromApi] = useState<Post[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal/content?kind=comunicado')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.items)) return;
        const mapped: Post[] = data.items.map(
          (it: { id: string; title: string; body: string | null; published_at: string }) => ({
            id: `api-${it.id}`,
            category: 'Institucional',
            title: it.title,
            summary: it.body || 'Comunicado corporativo.',
            date: it.published_at
              ? new Date(it.published_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '',
          }),
        );
        setFromApi(mapped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedPosts = useMemo(() => [...fromApi, ...(allPosts as Post[])], [fromApi]);

  const filtered = mergedPosts.filter((post) => {
    const matchCategory = activeCategory === 'Todos' || post.category === activeCategory;
    const matchSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featured = filtered.filter((p) => p.featured);
  const regular = filtered.filter((p) => !p.featured);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sl-navy px-6 pb-12 pt-28">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red-light">
            Comunicados
          </p>
          <h1 className="mb-4 font-heading text-4xl font-bold text-white md:text-5xl">Fique por dentro de tudo</h1>
          <p className="max-w-xl text-lg text-white/60">
            Notícias, atualizações e informações importantes para o seu dia a dia.
          </p>

          <div className="relative mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar comunicados..."
              className="w-full rounded-xl border border-white/10 bg-white/10 py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-white/40 transition-all focus:border-sl-red/30 focus:outline-none focus:ring-2 focus:ring-sl-red/30"
            />
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-30 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="scrollbar-hide flex gap-1 overflow-x-auto py-3">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat ? 'bg-sl-navy text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {featured.length > 0 && (
          <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2">
            {featured.map((post) => (
              <article key={post.id} className="group cursor-pointer">
                {post.image && (
                  <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-2xl">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-sl-navy/60 to-transparent" />
                    <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                      {post.category}
                    </span>
                  </div>
                )}
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <time className="text-xs text-muted-foreground">{post.date}</time>
                </div>
                <h2 className="mb-2 font-heading text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-sl-navy-light">
                  {post.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
              </article>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {regular.map((post) => (
            <article
              key={post.id}
              className="group flex cursor-pointer gap-5 rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-sl-navy/20 hover:shadow-md"
            >
              {post.image && (
                <div className="hidden h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg sm:block">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-sl-red">{post.category}</span>
                  <span className="text-xs text-muted-foreground">· {post.date}</span>
                </div>
                <h3 className="mb-1 font-heading text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-sl-navy-light">
                  {post.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">{post.summary}</p>
              </div>
              <ArrowRight className="h-5 w-5 flex-shrink-0 self-center text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-sl-red" />
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">Nenhum comunicado encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
