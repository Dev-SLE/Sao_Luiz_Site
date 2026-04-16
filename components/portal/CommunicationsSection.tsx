'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type NewsItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  cover_view_url?: string | null;
  is_featured?: boolean;
  publish_start?: string | null;
  created_at?: string | null;
};

function sortNews(list: NewsItem[]): NewsItem[] {
  return [...list].sort((a, b) => {
    const fa = a.is_featured ? 1 : 0;
    const fb = b.is_featured ? 1 : 0;
    if (fb !== fa) return fb - fa;
    const ta = new Date(a.publish_start || a.created_at || 0).getTime();
    const tb = new Date(b.publish_start || b.created_at || 0).getTime();
    return tb - ta;
  });
}

export function CommunicationsSection() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=news', { credentials: 'include' });
        if (!res.ok) {
          if (!c) setLoaded(true);
          return;
        }
        const data = await res.json();
        if (!c) {
          setItems((data.items || []) as NewsItem[]);
          setLoaded(true);
        }
      } catch {
        if (!c) setLoaded(true);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const sorted = useMemo(() => sortNews(items), [items]);
  const featured = sorted[0];
  const side = sorted.slice(1, 4);

  const formatDate = (it: NewsItem) => {
    const raw = it.publish_start || it.created_at;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <section id="comunicados" className="bg-secondary/50 px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Fique por dentro</p>
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Comunicados recentes</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Conteúdo do CMS (tipo <span className="font-mono text-xs">news</span>).
            </p>
          </div>
          <a
            href="/comunicados"
            className="hidden items-center gap-2 text-sm font-medium text-sl-red transition-colors hover:text-sl-red-light md:flex"
          >
            Ver todos <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {!loaded && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {loaded && !featured && (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-muted-foreground">Nenhum comunicado publicado para exibir aqui.</p>
            <Link href="/portal-edicao" className="mt-3 inline-block text-sm font-medium text-sl-red hover:text-sl-red-light">
              Publicar em /portal-edicao
            </Link>
          </div>
        )}

        {featured && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <article className="group">
              <Link href="/comunicados" className="block">
                {featured.cover_view_url ? (
                  <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-2xl">
                    <img
                      src={featured.cover_view_url}
                      alt={featured.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-sl-navy/70 to-transparent" />
                    <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                      {featured.category?.trim() || 'Geral'}
                    </span>
                  </div>
                ) : (
                  <div className="mb-5">
                    <span className="inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                      {featured.category?.trim() || 'Geral'}
                    </span>
                  </div>
                )}
                <time className="text-xs text-muted-foreground">{formatDate(featured)}</time>
                <h3 className="mt-2 font-heading text-2xl font-bold leading-tight text-foreground transition-colors group-hover:text-sl-navy-light">
                  {featured.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {(featured.subtitle || featured.description || '').trim() || '—'}
                </p>
              </Link>
            </article>

            <div className="space-y-6">
              {side.map((post) => (
                <article key={post.id} className="group">
                  <Link href="/comunicados" className="flex gap-5 rounded-xl p-4 transition-colors duration-200 hover:bg-card">
                    {post.cover_view_url ? (
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg">
                        <img
                          src={post.cover_view_url}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-sl-red">{post.category?.trim() || 'Geral'}</span>
                        <span className="text-xs text-muted-foreground">· {formatDate(post)}</span>
                      </div>
                      <h4 className="font-heading text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sl-navy-light">
                        {post.title}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {(post.subtitle || post.description || '').trim() || '—'}
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
