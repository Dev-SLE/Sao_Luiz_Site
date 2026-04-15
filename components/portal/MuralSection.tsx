import { Heart, MessageCircle, Share2 } from 'lucide-react';

const muralPosts = [
  {
    id: 1,
    author: 'São Luiz Express',
    avatar: 'SL',
    time: 'Há 2 horas',
    content:
      'Parabéns à equipe de São Paulo pelo recorde de entregas sem avarias! Vocês são demais!',
    image: '/portal-assets/team-warehouse.jpg',
    likes: 48,
    comments: 12,
  },
  {
    id: 2,
    author: 'RH — Gente & Gestão',
    avatar: 'RH',
    time: 'Há 5 horas',
    content: 'Amanhã é dia de confraternização na unidade Recife! Confirme sua presença com seu gestor.',
    likes: 32,
    comments: 8,
  },
  {
    id: 3,
    author: 'Segurança do Trabalho',
    avatar: 'ST',
    time: 'Ontem',
    content:
      'Dica de segurança: antes de iniciar a viagem, sempre faça a checklist completa do veículo. Sua vida é o que mais importa!',
    likes: 56,
    comments: 4,
  },
];

export function MuralSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Mural</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Nossa comunidade</h2>
        </div>

        <div className="space-y-6">
          {muralPosts.map((post, index) => (
            <article
              key={post.id}
              className="animate-fade-in-up rounded-2xl border border-border bg-card p-6"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sl-navy">
                  <span className="font-heading text-xs font-bold text-white">{post.avatar}</span>
                </div>
                <div>
                  <p className="font-heading text-sm font-semibold text-foreground">{post.author}</p>
                  <p className="text-xs text-muted-foreground">{post.time}</p>
                </div>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-foreground">{post.content}</p>

              {post.image && (
                <div className="mb-4 aspect-[16/9] overflow-hidden rounded-xl">
                  <img src={post.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}

              <div className="flex items-center gap-6 border-t border-border pt-2">
                <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-sl-red">
                  <Heart className="h-4 w-4" />
                  <span>{post.likes}</span>
                </button>
                <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-sl-navy-light">
                  <MessageCircle className="h-4 w-4" />
                  <span>{post.comments}</span>
                </button>
                <button type="button" className="ml-auto flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-sl-navy-light">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
