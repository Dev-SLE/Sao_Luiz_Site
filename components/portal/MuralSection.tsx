'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Heart, MessageCircle, Share2 } from 'lucide-react';

type MuralItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  cover_view_url?: string | null;
  publish_start?: string | null;
  created_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

function initialsFrom(label: string): string {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    return `${a}${b}`.toUpperCase();
  }
  return (label.slice(0, 2) || '—').toUpperCase();
}

function metaNum(m: Record<string, unknown> | null | undefined, key: string): number {
  const v = m?.[key];
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

export function MuralSection() {
  const [items, setItems] = useState<MuralItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=mural', { credentials: 'include' });
        if (!res.ok) {
          if (!c) setLoaded(true);
          return;
        }
        const data = await res.json();
        if (!c) {
          setItems((data.items || []) as MuralItem[]);
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

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Mural</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Nossa comunidade</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Publicações feitas em <span className="font-mono text-xs">/portal-edicao</span> (tipo mural). Subtítulo = autor ou área; descrição = texto; capa = imagem opcional.
          </p>
        </div>

        {!loaded && (
          <p className="text-center text-sm text-muted-foreground">Carregando mural…</p>
        )}

        {loaded && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
            <p className="text-muted-foreground">Nenhuma postagem no mural ainda.</p>
            <a
              href="/portal-edicao"
              className="mt-4 inline-block text-sm font-medium text-sl-red hover:text-sl-red-light"
            >
              Cadastrar no gestor do portal
            </a>
          </div>
        )}

        <div className="space-y-6">
          {items.map((post, index) => {
            const author = post.subtitle?.trim() || 'Comunicação interna';
            const meta = post.metadata_json;
            const initials =
              typeof meta?.initials === 'string' && meta.initials.trim()
                ? String(meta.initials).slice(0, 3).toUpperCase()
                : initialsFrom(author);
            const raw = post.publish_start || post.created_at;
            const timeLabel = raw
              ? formatDistanceToNow(new Date(raw), { addSuffix: true, locale: ptBR })
              : '';
            const body = (post.description || post.title || '').trim();
            const likes = metaNum(meta, 'likes');
            const comments = metaNum(meta, 'comments');

            return (
              <article
                key={post.id}
                className="animate-fade-in-up rounded-2xl border border-border bg-card p-6"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sl-navy">
                    <span className="font-heading text-xs font-bold text-white">{initials}</span>
                  </div>
                  <div>
                    <p className="font-heading text-sm font-semibold text-foreground">{author}</p>
                    {timeLabel ? <p className="text-xs text-muted-foreground">{timeLabel}</p> : null}
                  </div>
                </div>

                {post.title && post.description ? (
                  <p className="mb-2 font-heading text-sm font-semibold text-foreground">{post.title}</p>
                ) : null}
                <p className="mb-4 text-sm leading-relaxed text-foreground">{body}</p>

                {post.cover_view_url ? (
                  <div className="mb-4 aspect-[16/9] overflow-hidden rounded-xl">
                    <img
                      src={post.cover_view_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="flex items-center gap-6 border-t border-border pt-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-sl-red"
                    aria-label="Curtidas (somente visual)"
                  >
                    <Heart className="h-4 w-4" />
                    <span>{likes}</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-sl-navy-light"
                    aria-label="Comentários (somente visual)"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>{comments}</span>
                  </button>
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-sl-navy-light"
                    aria-label="Compartilhar"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
