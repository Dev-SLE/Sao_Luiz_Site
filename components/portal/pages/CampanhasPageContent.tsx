'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Star, Trophy, Users } from 'lucide-react';

type ContentRow = {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  cover_view_url?: string | null;
  is_featured?: boolean;
  display_order?: number;
  publish_start?: string | null;
  created_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

function metaNum(m: Record<string, unknown> | null | undefined, key: string): number | undefined {
  const v = m?.[key];
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function metaStr(m: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const v = m?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name.slice(0, 2) || '—').toUpperCase();
}

function sortCampaigns(list: ContentRow[]): ContentRow[] {
  return [...list].sort((a, b) => {
    const fa = a.is_featured ? 1 : 0;
    const fb = b.is_featured ? 1 : 0;
    if (fb !== fa) return fb - fa;
    const oa = Number(a.display_order) || 0;
    const ob = Number(b.display_order) || 0;
    if (oa !== ob) return oa - ob;
    const ta = new Date(a.publish_start || a.created_at || 0).getTime();
    const tb = new Date(b.publish_start || b.created_at || 0).getTime();
    return tb - ta;
  });
}

export function CampanhasPageContent() {
  const [campaigns, setCampaigns] = useState<ContentRow[]>([]);
  const [recognitions, setRecognitions] = useState<ContentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [cRes, rRes] = await Promise.all([
          fetch('/api/content?type=campaign', { credentials: 'include' }),
          fetch('/api/content?type=recognition', { credentials: 'include' }),
        ]);
        if (!c) {
          if (cRes.ok) {
            const d = await cRes.json();
            setCampaigns((d.items || []) as ContentRow[]);
          }
          if (rRes.ok) {
            const d2 = await rRes.json();
            setRecognitions((d2.items || []) as ContentRow[]);
          }
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

  const orderedCampaigns = useMemo(() => sortCampaigns(campaigns), [campaigns]);
  const spotlight = orderedCampaigns[0];
  const gridCampaigns = orderedCampaigns.slice(1);

  const spotlightMeta = spotlight?.metadata_json;
  const quote =
    metaStr(spotlightMeta, 'quote') ||
    (spotlight?.description || '').trim().split('\n')[0] ||
    '';
  const achievement =
    metaStr(spotlightMeta, 'achievement') || spotlight?.category?.trim() || spotlight?.subtitle?.trim() || '';

  const heroBg = spotlight?.cover_view_url;

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-16">
        <div className="relative flex min-h-[60vh] items-center overflow-hidden bg-sl-navy">
          {heroBg ? (
            <div className="absolute inset-0 opacity-20">
              <img src={heroBg} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-sl-navy via-sl-navy to-sl-red/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-sl-navy via-sl-navy/95 to-sl-navy/70" />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20">
            {!loaded && <p className="text-white/60">Carregando destaque…</p>}

            {loaded && !spotlight && (
              <div className="max-w-xl">
                <p className="font-heading text-sm font-semibold uppercase tracking-widest text-amber-400">Destaque do mês</p>
                <h1 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">Nenhuma campanha publicada</h1>
                <p className="mt-3 text-white/60">
                  Cadastre itens do tipo <span className="font-mono text-xs">campaign</span> em{' '}
                  <a href="/portal-edicao" className="text-sl-red-light underline-offset-2 hover:underline">
                    /portal-edicao
                  </a>
                  . Marque um item como destaque (featured) no gestor para priorizar no topo.
                </p>
              </div>
            )}

            {spotlight && (
              <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
                <div>
                  <div className="mb-6 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    <span className="font-heading text-sm font-semibold uppercase tracking-widest text-amber-400">
                      Destaque do mês
                    </span>
                  </div>
                  <h1 className="mb-4 font-heading text-4xl font-bold leading-tight text-white md:text-5xl">{spotlight.title}</h1>
                  {(spotlight.subtitle || '').trim() ? (
                    <p className="mb-2 text-lg text-white/60">{spotlight.subtitle}</p>
                  ) : null}
                  {achievement ? (
                    <p className="mb-6 font-heading text-sm font-semibold text-sl-red-light">{achievement}</p>
                  ) : (
                    <div className="mb-6" />
                  )}
                  {quote ? (
                    <blockquote className="max-w-md border-l-2 border-sl-red pl-4 text-lg italic text-white/80">
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  ) : null}
                </div>
                <div className="flex justify-center md:justify-end">
                  <div className="h-72 w-72 overflow-hidden rounded-3xl border-4 border-white/10 shadow-2xl md:h-80 md:w-80">
                    {spotlight.cover_view_url ? (
                      <img
                        src={spotlight.cover_view_url}
                        alt={spotlight.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                        <span className="font-heading text-4xl font-bold text-white/40">
                          {initialsFrom(spotlight.title)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Campanhas ativas</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Faça parte da mudança</h2>
        </div>

        {!loaded && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {loaded && gridCampaigns.length === 0 && spotlight && (
          <p className="text-sm text-muted-foreground">
            Apenas o destaque está publicado. Adicione mais campanhas no gestor para listar aqui.
          </p>
        )}

        {loaded && campaigns.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-muted-foreground">
            Nenhuma campanha na lista.
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {gridCampaigns.map((campaign) => {
            const m = campaign.metadata_json;
            const tag = metaStr(m, 'tag');
            const progress = metaNum(m, 'progress');
            const goal = metaNum(m, 'goal');
            const metric = metaStr(m, 'metric') || 'meta';
            const participants = metaNum(m, 'participants');
            const img = campaign.cover_view_url;

            return (
              <article
                key={campaign.id}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl"
              >
                <div className="relative aspect-[2/1] overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={campaign.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-sl-navy/90 to-sl-red/20" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-sl-navy/70 to-transparent" />
                  {tag ? (
                    <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
                      {tag}
                    </span>
                  ) : null}
                </div>
                <div className="p-6">
                  <h3 className="mb-2 font-heading text-xl font-bold text-foreground transition-colors group-hover:text-sl-navy-light">
                    {campaign.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    {campaign.description || campaign.subtitle || ''}
                  </p>

                  {progress !== undefined && goal !== undefined && goal > 0 ? (
                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {progress} {metric}
                        </span>
                        <span className="font-semibold text-sl-red">Meta: {goal}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="gradient-red h-full rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {participants !== undefined ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{participants} participantes</span>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="bg-secondary/50 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Mural de reconhecimento</p>
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Quem faz a diferença</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Itens do tipo <span className="font-mono text-xs">recognition</span>: título = nome, subtítulo = selo, categoria = unidade. Opcional: capa (foto) e iniciais em{' '}
              <span className="font-mono text-xs">metadata_json.initials</span>.
            </p>
          </div>

          {!loaded && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}

          {loaded && recognitions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center">
              <p className="text-muted-foreground">Nenhum reconhecimento publicado.</p>
              <a href="/portal-edicao" className="mt-3 inline-block text-sm font-medium text-sl-red hover:text-sl-red-light">
                Cadastrar em /portal-edicao
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recognitions.map((person, index) => {
              const badge = person.subtitle?.trim() || 'Reconhecimento';
              const unit = person.category?.trim() || '';
              const meta = person.metadata_json;
              const avatarLetters =
                typeof meta?.initials === 'string' && meta.initials.trim()
                  ? String(meta.initials).slice(0, 3).toUpperCase()
                  : initialsFrom(person.title);
              const when = person.publish_start || person.created_at;
              const whenLabel = when
                ? formatDistanceToNow(new Date(when), { addSuffix: true, locale: ptBR })
                : '';

              return (
                <div
                  key={person.id}
                  className="flex animate-fade-in-up items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {person.cover_view_url ? (
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-border">
                      <img src={person.cover_view_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-sl-navy">
                      <span className="font-heading text-sm font-bold text-white">{avatarLetters}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-semibold text-foreground">{person.title}</p>
                    {unit ? <p className="text-xs text-muted-foreground">{unit}</p> : null}
                    {whenLabel ? <p className="text-[10px] text-muted-foreground/80">{whenLabel}</p> : null}
                    <div className="mt-1 flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">{badge}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
