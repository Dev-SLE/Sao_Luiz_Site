'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Star } from 'lucide-react';

type RemoteItem = {
  id: string;
  title: string;
  description?: string | null;
  cover_view_url?: string | null;
  subtitle?: string | null;
  metadata_json?: Record<string, unknown> | null;
  is_featured?: boolean;
  display_order?: number;
  publish_start?: string | null;
  created_at?: string | null;
};

function sortCampaigns(list: RemoteItem[]): RemoteItem[] {
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

export function CampaignsSection() {
  const [remote, setRemote] = useState<RemoteItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=campaign', { credentials: 'include' });
        if (!res.ok) {
          if (!c) setLoaded(true);
          return;
        }
        const data = await res.json();
        if (!c) {
          setRemote((data.items || []) as RemoteItem[]);
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

  if (!loaded) {
    return (
      <section id="campanhas" className="bg-sl-navy px-6 py-20">
        <div className="mx-auto max-w-7xl text-center text-sm text-white/60">Carregando campanhas…</div>
      </section>
    );
  }

  if (remote.length === 0) {
    return (
      <section id="campanhas" className="bg-sl-navy px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
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
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-14 text-center">
            <p className="text-white/70">Nenhuma campanha publicada no momento.</p>
            <a href="/portal-edicao" className="mt-4 inline-block text-sm font-medium text-sl-red-light hover:text-white">
              Publicar em /portal-edicao
            </a>
          </div>
        </div>
      </section>
    );
  }

  const ordered = sortCampaigns(remote);
  const primary = ordered[0];
  const side = ordered.slice(1);

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
              {primary.cover_view_url ? (
                <img
                  src={primary.cover_view_url}
                  alt={primary.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-sl-navy via-sl-navy/90 to-sl-red/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-sl-navy via-sl-navy/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="font-heading text-sm font-semibold text-amber-400">Destaque</span>
                </div>
                <h3 className="mb-2 font-heading text-2xl font-bold text-white">{primary.title}</h3>
                {(() => {
                  const desc = (primary.description || '').trim();
                  const sub = (primary.subtitle || '').trim();
                  return (
                    <>
                      <p className="mb-3 text-sm text-white/70">{desc || sub}</p>
                      {sub && desc ? <p className="font-heading text-sm font-semibold text-sl-red-light">{sub}</p> : null}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {side.map((campaign) => {
              const m = campaign.metadata_json;
              const tag = metaStr(m, 'tag') || campaign.subtitle || undefined;
              const progress = metaNum(m, 'progress');
              const goal = metaNum(m, 'goal');

              return (
                <div
                  key={campaign.id}
                  className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:bg-white/10"
                >
                  {tag ? (
                    <span className="mb-3 inline-flex items-center rounded-full bg-sl-red/20 px-2.5 py-0.5 text-xs font-semibold text-sl-red-light">
                      {tag}
                    </span>
                  ) : null}
                  <h4 className="mb-2 font-heading text-lg font-semibold text-white">{campaign.title}</h4>
                  <p className="text-sm leading-relaxed text-white/60">{campaign.description || ''}</p>
                  {progress !== undefined && goal !== undefined && goal > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-white/50">Progresso</span>
                        <span className="font-semibold text-sl-red-light">
                          {progress}/{goal}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-sl-red-light transition-all duration-500"
                          style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
