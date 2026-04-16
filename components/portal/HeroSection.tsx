'use client';

import { useEffect, useState } from 'react';

export function HeroSection() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=banner', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const items = (data?.items || []) as { cover_view_url?: string | null; is_featured?: boolean; display_order?: number }[];
        if (!items.length) return;
        const sorted = [...items].sort((a, b) => {
          const af = a.is_featured ? 1 : 0;
          const bf = b.is_featured ? 1 : 0;
          if (bf !== af) return bf - af;
          return (a.display_order ?? 0) - (b.display_order ?? 0);
        });
        const first = sorted.find((x) => x.cover_view_url);
        if (!cancelled && first?.cover_view_url) {
          const u = String(first.cover_view_url);
          setHeroUrl(u.startsWith('/') ? u : `/${u}`);
        }
      } catch {
        /* mantém fundo em gradiente */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative flex min-h-[600px] h-[85vh] items-end overflow-hidden">
      {heroUrl ? (
        <img
          src={heroUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-sl-navy via-sl-navy to-sl-red/25"
          aria-hidden
        />
      )}

      <div className="overlay-dark-strong absolute inset-0" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 md:pb-24">
        <div className="max-w-2xl space-y-6">
          <p className="animate-fade-in-up font-body text-sm uppercase tracking-widest text-white/60">
            Portal do Colaborador
          </p>
          <h1 className="animate-fade-in-up animation-delay-100 font-heading text-4xl font-bold leading-tight text-white md:text-6xl">
            {greeting}, <br />
            <span className="text-sl-red-light">colaborador.</span>
          </h1>
          <p className="animate-fade-in-up animation-delay-200 font-body text-lg leading-relaxed text-white/70 md:text-xl">
            Conectando pessoas, operações e resultados.
          </p>

          <div className="flex flex-wrap gap-4 pt-4 animate-fade-in-up animation-delay-300">
            <a
              href="#comunicados"
              className="inline-flex items-center rounded-lg bg-sl-red px-6 py-3 font-heading text-sm font-semibold text-white transition-all duration-300 hover:translate-y-[-2px] hover:bg-sl-red-light hover:shadow-lg hover:shadow-sl-red/30"
            >
              Ver Comunicados
            </a>
            <a
              href="#atalhos"
              className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-heading text-sm font-semibold text-white transition-all duration-300 hover:translate-y-[-2px] hover:bg-white/20"
            >
              Acesso Rápido
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
