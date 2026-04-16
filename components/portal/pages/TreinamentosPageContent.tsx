'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play, Clock, BookOpen, CheckCircle2, Lock, X } from 'lucide-react';
import Link from 'next/link';
import { isVideoMime } from '@/lib/portalMedia';

type CourseStatus = 'available' | 'completed' | 'locked';

type Course = {
  id: string | number;
  title: string;
  description?: string;
  image: string | null;
  poster?: string | null;
  videoUrl?: string | null;
  mainMime?: string | null;
  duration: string;
  modules: number;
  category: string;
  status: CourseStatus;
  featured?: boolean;
  progress?: number;
};

function metaStr(meta: unknown, key: string): string {
  if (!meta || typeof meta !== 'object') return '';
  const v = (meta as Record<string, unknown>)[key];
  return v != null ? String(v) : '';
}

function metaNum(meta: unknown, key: string, fallback: number): number {
  if (!meta || typeof meta !== 'object') return fallback;
  const n = Number((meta as Record<string, unknown>)[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function metaProgress(meta: unknown): number {
  if (!meta || typeof meta !== 'object') return 0;
  const n = Number((meta as Record<string, unknown>).progress);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n));
}

function sortCourses(list: Course[]): Course[] {
  return [...list].sort((a, b) => {
    const fa = a.featured ? 1 : 0;
    const fb = b.featured ? 1 : 0;
    if (fb !== fa) return fb - fa;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function TreinamentosPageContent() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [remoteList, setRemoteList] = useState<Course[]>([]);
  const [player, setPlayer] = useState<Course | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=training', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = await res.json();
        const items = (data?.items || []) as {
          id: string;
          title: string;
          description?: string | null;
          subtitle?: string | null;
          category?: string | null;
          cover_view_url?: string | null;
          main_view_url?: string | null;
          main_mime?: string | null;
          is_featured?: boolean;
          metadata_json?: unknown;
          publish_start?: string | null;
        }[];
        if (cancelled) return;
        setRemoteList(
          items.map((it) => {
            const meta = it.metadata_json;
            const duration = metaStr(meta, 'duration') || '—';
            const modules = metaNum(meta, 'modules', 1);
            const poster = it.cover_view_url || null;
            const videoUrl = it.main_view_url || null;
            const mainMime = it.main_mime || null;
            const progress = metaProgress(meta);
            return {
              id: it.id,
              title: it.title,
              description: it.description || it.subtitle || undefined,
              image: poster,
              poster,
              videoUrl,
              mainMime,
              duration,
              modules,
              category: (it.category || 'Geral').trim() || 'Geral',
              status: 'available' as const,
              featured: !!it.is_featured,
              progress: progress > 0 ? progress : undefined,
            };
          }),
        );
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    remoteList.forEach((c) => set.add(c.category));
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [remoteList]);

  useEffect(() => {
    if (activeCategory !== 'Todos' && !categories.includes(activeCategory)) {
      setActiveCategory('Todos');
    }
  }, [activeCategory, categories]);

  const coursePool = useMemo(() => sortCourses(remoteList), [remoteList]);

  const hero = useMemo(() => {
    if (coursePool.length === 0) return null;
    return coursePool.find((c) => c.featured) || coursePool[0];
  }, [coursePool]);

  const heroIsVideo = !!(hero?.videoUrl && isVideoMime(hero.mainMime));

  const filtered =
    activeCategory === 'Todos' ? coursePool : coursePool.filter((c) => c.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-16">
        <div className="relative flex h-[50vh] min-h-[400px] items-end overflow-hidden">
          {!loaded && <div className="absolute inset-0 bg-sl-navy" />}
          {loaded && !hero && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-sl-navy via-sl-navy to-sl-red/20 px-6">
              <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">Treinamentos</h1>
              <p className="mt-3 max-w-md text-center text-sm text-white/70">
                Nenhum treinamento publicado. Cadastre itens do tipo <span className="font-mono text-xs">training</span> em{' '}
                <Link href="/portal-edicao" className="text-sl-red-light underline-offset-2 hover:underline">
                  /portal-edicao
                </Link>
                .
              </p>
            </div>
          )}
          {hero && (
            <>
              {heroIsVideo && hero.videoUrl ? (
                <video
                  key={String(hero.id)}
                  className="absolute inset-0 h-full w-full object-cover"
                  poster={hero.poster || hero.image || undefined}
                  src={hero.videoUrl}
                  controls
                  playsInline
                />
              ) : hero.image ? (
                <img src={hero.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sl-navy via-sl-navy/95 to-sl-red/25" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-sl-navy via-sl-navy/60 to-sl-navy/20" />
              <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-12">
                <span className="mb-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                  {hero.category}
                </span>
                <h1 className="mb-3 max-w-2xl font-heading text-3xl font-bold leading-tight text-white md:text-5xl">
                  {hero.title}
                </h1>
                <p className="mb-6 max-w-xl text-base text-white/70">{hero.description || ''}</p>
                <div className="mb-6 flex flex-wrap items-center gap-6">
                  <span className="flex items-center gap-2 text-sm text-white/60">
                    <Clock className="h-4 w-4" /> {hero.duration}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-white/60">
                    <BookOpen className="h-4 w-4" /> {hero.modules} módulos
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (hero.videoUrl && isVideoMime(hero.mainMime)) {
                        setPlayer(hero);
                      }
                    }}
                    disabled={!(hero.videoUrl && isVideoMime(hero.mainMime))}
                    className="inline-flex items-center gap-2 rounded-lg bg-sl-red px-6 py-3 font-heading text-sm font-semibold text-white transition-all duration-300 hover:translate-y-[-2px] hover:bg-sl-red-light hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Play className="h-4 w-4 fill-white" />{' '}
                    {hero.videoUrl && isVideoMime(hero.mainMime) ? 'Assistir' : 'Sem vídeo vinculado'}
                  </button>
                  {hero.progress != null && hero.progress > 0 ? (
                    <div className="hidden items-center gap-3 sm:flex">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-sl-red" style={{ width: `${hero.progress}%` }} />
                      </div>
                      <span className="text-xs text-white/60">{hero.progress}%</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
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
        <h2 className="mb-8 font-heading text-2xl font-bold text-foreground">Todos os treinamentos</h2>

        {loaded && remoteList.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum item na grade.</p>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((course) => {
            const hasVideo = !!(course.videoUrl && isVideoMime(course.mainMime));
            return (
              <article
                key={course.id}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:translate-y-[-4px] hover:border-sl-navy/20 hover:shadow-xl"
                onClick={() => {
                  if (hasVideo && course.videoUrl) {
                    setPlayer(course);
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && hasVideo && course.videoUrl) {
                    e.preventDefault();
                    setPlayer(course);
                  }
                }}
                role={hasVideo ? 'button' : undefined}
                tabIndex={hasVideo ? 0 : undefined}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-sl-navy/80 to-sl-red/20" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {course.status === 'completed' && (
                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {course.status === 'locked' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-sl-navy/60">
                      <Lock className="h-8 w-8 text-white/60" />
                    </div>
                  )}
                  {course.status !== 'locked' && hasVideo && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sl-red/90">
                        <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-semibold text-sl-red">{course.category}</span>
                  <h3 className="mt-1 mb-3 line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sl-navy-light">
                    {course.title}
                  </h3>
                  {course.description ? <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{course.description}</p> : null}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {course.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> {course.modules} módulos
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {loaded && filtered.length === 0 && remoteList.length > 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">Nenhum treinamento nesta categoria.</p>
        )}
      </div>

      {player && player.videoUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Reproduzir treinamento"
          onClick={() => setPlayer(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-full bg-background/90 p-2 text-foreground shadow"
              onClick={() => setPlayer(null)}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-3 pr-10 font-heading text-lg font-semibold text-foreground">{player.title}</h3>
            <video className="w-full max-h-[70vh] rounded-lg bg-black" controls playsInline autoPlay poster={player.poster || player.image || undefined}>
              <source src={player.videoUrl} type={player.mainMime || 'video/mp4'} />
            </video>
          </div>
        </div>
      ) : null}
    </div>
  );
}
