'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Calendar } from 'lucide-react';

type RemoteNews = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  created_at?: string;
};

export function NoticesSection() {
  const [remote, setRemote] = useState<RemoteNews[]>([]);
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
          setRemote(data.items || []);
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

  const notices = remote.map((n, i) => {
    const cat = (n.category || 'info').toLowerCase();
    const type = cat.includes('urg') ? ('urgent' as const) : cat.includes('imp') ? ('important' as const) : ('info' as const);
    return {
      id: n.id || String(i),
      type,
      title: n.title,
      summary: n.description || '',
      date: n.created_at ? new Date(n.created_at).toLocaleDateString('pt-BR') : '',
    };
  });

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Comunicação interna</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Comunicados</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Conteúdo publicado via CMS (tipo <span className="font-mono text-xs">news</span>). Sem itens publicados, a seção fica vazia até o gestor cadastrar.
          </p>
        </div>

        {!loaded && <p className="text-center text-sm text-muted-foreground">Carregando comunicados…</p>}

        {loaded && notices.length === 0 && (
          <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <p className="text-muted-foreground">Nenhum comunicado publicado para a home.</p>
            <a href="/portal-edicao" className="mt-3 inline-block text-sm font-medium text-sl-red hover:text-sl-red-light">
              Abrir edição do portal
            </a>
          </div>
        )}

        {notices.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {notices.map((n) => (
              <article
                key={n.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-lg"
              >
                <div className="mb-3 flex items-center gap-2">
                  {n.type === 'urgent' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  <span className="text-xs font-semibold uppercase text-sl-red">{n.type}</span>
                </div>
                <h3 className="font-heading text-base font-bold text-foreground">{n.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{n.summary}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {n.date}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/comunicados"
            className="inline-flex items-center gap-2 text-sm font-medium text-sl-red hover:text-sl-red-light"
          >
            Ver área de comunicados <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
