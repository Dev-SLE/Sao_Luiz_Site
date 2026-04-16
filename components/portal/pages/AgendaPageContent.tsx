'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type EventType = 'event' | 'deadline' | 'training' | 'social' | 'maintenance';

type AgendaEvent = {
  id: string | number;
  /** YYYY-MM-DD — usado para filtrar por mês/ano */
  isoDate: string;
  date: string;
  month: string;
  weekday: string;
  title: string;
  description: string;
  time: string;
  location?: string;
  type: EventType;
  color: string;
};

const typeLabels: Record<string, { label: string; style: string }> = {
  event: { label: 'Evento', style: 'bg-sl-red/10 text-sl-red' },
  deadline: { label: 'Prazo', style: 'bg-amber-500/10 text-amber-600' },
  training: { label: 'Treinamento', style: 'bg-blue-500/10 text-blue-600' },
  social: { label: 'Social', style: 'bg-emerald-500/10 text-emerald-600' },
  maintenance: { label: 'Manutenção', style: 'bg-orange-500/10 text-orange-600' },
};

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapApiAgendaRow(raw: {
  id: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  published_at: string;
}): AgendaEvent {
  const d = raw.published_at ? new Date(raw.published_at) : new Date();
  const meta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const t = String(meta.eventType || 'event') as EventType;
  const safeType: EventType = typeLabels[t] ? t : 'event';
  const isoDate = toIsoDate(d);
  return {
    id: raw.id,
    isoDate,
    date: String(d.getDate()),
    month: MONTH_ABBR[d.getMonth()] || '—',
    weekday: WEEKDAY_SHORT[d.getDay()] || '—',
    title: raw.title,
    description: raw.body || '',
    time: String(meta.timeRange || ''),
    location: meta.location ? String(meta.location) : undefined,
    type: safeType,
    color: String(meta.color || 'border-l-sl-red'),
  };
}

export function AgendaPageContent() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [fromApi, setFromApi] = useState<AgendaEvent[]>([]);

  const viewYear = cursor.getFullYear();
  const viewMonth = cursor.getMonth();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal/agenda', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.items)) return;
        setFromApi(
          (
            data.items as {
              id: string;
              title: string;
              body: string | null;
              metadata: Record<string, unknown> | null;
              published_at: string;
            }[]
          ).map(mapApiAgendaRow),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedEvents = useMemo(() => fromApi, [fromApi]);

  const filteredEvents = useMemo(() => {
    return mergedEvents.filter((ev) => {
      const d = new Date(`${ev.isoDate}T12:00:00`);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [mergedEvents, viewYear, viewMonth]);

  const goMonth = useCallback((delta: number) => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }, []);

  const goToday = useCallback(() => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sl-navy px-6 pb-12 pt-28">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red-light">Agenda</p>
          <h1 className="mb-4 font-heading text-4xl font-bold text-white md:text-5xl">Calendário de eventos</h1>
          <p className="max-w-xl text-lg text-white/60">
            Eventos cadastrados em <span className="font-mono text-sm text-white/80">/portal-edicao</span> (aba Agenda). Sem itens
            publicados, o calendário fica vazio até o gestor incluir datas.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">
              {months[viewMonth]} {viewYear}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filteredEvents.length} evento{filteredEvents.length === 1 ? '' : 's'} neste mês
            </p>
            <button
              type="button"
              onClick={goToday}
              className="mt-2 text-xs font-semibold text-sl-red underline"
            >
              Ir para o mês atual
            </button>
          </div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="relative">
          <div className="absolute bottom-0 left-[39px] top-0 hidden w-px bg-border md:block" />

          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum evento neste mês.</p>
              <a href="/portal-edicao" className="mt-3 inline-block text-sm font-medium text-sl-red hover:text-sl-red-light">
                Cadastrar na edição do portal (aba Agenda)
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredEvents.map((event, index) => {
                const typeInfo = typeLabels[event.type] || typeLabels.event;
                return (
                  <div
                    key={String(event.id)}
                    className="flex gap-6 animate-fade-in-up"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="relative z-10 hidden flex-shrink-0 flex-col items-center md:flex">
                      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl border border-border bg-card">
                        <span className="font-heading text-2xl font-bold leading-none text-foreground">{event.date}</span>
                        <span className="text-xs font-semibold text-sl-red">{event.month}</span>
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground">{event.weekday}</span>
                    </div>

                    <div
                      className={`flex-1 cursor-pointer rounded-xl border border-border border-l-4 bg-card p-6 transition-all duration-300 hover:shadow-lg ${event.color}`}
                    >
                      <div className="mb-3 flex items-center gap-2 md:hidden">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {event.date} {event.month} · {event.weekday}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeInfo.style}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                          <h3 className="mb-1 font-heading text-lg font-semibold text-foreground">{event.title}</h3>
                          <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>

                          <div className="mt-4 flex flex-wrap items-center gap-4">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> {event.time}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" /> {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
