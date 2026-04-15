'use client';

import { useState } from 'react';
import { Calendar, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const upcomingEvents = [
  {
    id: 1,
    date: '10',
    month: 'ABR',
    weekday: 'Quinta',
    title: 'SIPAT 2026 — Abertura',
    description: 'Cerimônia de abertura com palestra sobre segurança no trânsito.',
    time: '09:00 - 12:00',
    location: 'Auditório Principal — Matriz',
    type: 'event' as const,
    color: 'border-l-sl-red',
  },
  {
    id: 2,
    date: '11',
    month: 'ABR',
    weekday: 'Sexta',
    title: 'Prazo — Entrega do formulário de férias',
    description: 'Último dia para envio do formulário de programação de férias do 2º semestre.',
    time: 'Até 18:00',
    type: 'deadline' as const,
    color: 'border-l-amber-500',
  },
  {
    id: 3,
    date: '14',
    month: 'ABR',
    weekday: 'Segunda',
    title: 'Treinamento — Direção Defensiva (Turma 3)',
    description: 'Aula prática no pátio da unidade São Paulo. Presença obrigatória.',
    time: '08:00 - 17:00',
    location: 'Unidade São Paulo',
    type: 'training' as const,
    color: 'border-l-blue-500',
  },
  {
    id: 4,
    date: '15',
    month: 'ABR',
    weekday: 'Terça',
    title: 'Live — Resultados do 1º Trimestre',
    description: 'Apresentação dos resultados com o diretor geral. Transmissão ao vivo para todas as unidades.',
    time: '15:00 - 16:30',
    location: 'Online — Teams',
    type: 'event' as const,
    color: 'border-l-sl-red',
  },
  {
    id: 5,
    date: '18',
    month: 'ABR',
    weekday: 'Sexta',
    title: 'Confraternização — Aniversariantes de Abril',
    description: 'Comemoração para os aniversariantes do mês com café da manhã especial.',
    time: '10:00 - 11:00',
    location: 'Refeitório — Todas as unidades',
    type: 'social' as const,
    color: 'border-l-emerald-500',
  },
  {
    id: 6,
    date: '22',
    month: 'ABR',
    weekday: 'Terça',
    title: 'Manutenção Programada — Sistema de Rastreamento',
    description: 'O sistema ficará indisponível para atualização de segurança.',
    time: '22:00 - 02:00',
    type: 'maintenance' as const,
    color: 'border-l-orange-500',
  },
  {
    id: 7,
    date: '25',
    month: 'ABR',
    weekday: 'Sexta',
    title: 'Workshop — Liderança Colaborativa',
    description: 'Dinâmicas de grupo e cases práticos para gestores e coordenadores.',
    time: '09:00 - 12:00',
    location: 'Sala de Reuniões — Matriz',
    type: 'training' as const,
    color: 'border-l-blue-500',
  },
];

const typeLabels: Record<string, { label: string; style: string }> = {
  event: { label: 'Evento', style: 'bg-sl-red/10 text-sl-red' },
  deadline: { label: 'Prazo', style: 'bg-amber-500/10 text-amber-600' },
  training: { label: 'Treinamento', style: 'bg-blue-500/10 text-blue-600' },
  social: { label: 'Social', style: 'bg-emerald-500/10 text-emerald-600' },
  maintenance: { label: 'Manutenção', style: 'bg-orange-500/10 text-orange-600' },
};

export function AgendaPageContent() {
  const [currentMonth] = useState(3);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sl-navy px-6 pb-12 pt-28">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red-light">Agenda</p>
          <h1 className="mb-4 font-heading text-4xl font-bold text-white md:text-5xl">Calendário de eventos</h1>
          <p className="max-w-xl text-lg text-white/60">
            Acompanhe treinamentos, prazos, eventos e datas importantes.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 flex items-center justify-between">
          <button type="button" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">
              {months[currentMonth]} 2026
            </h2>
            <p className="text-sm text-muted-foreground">{upcomingEvents.length} eventos este mês</p>
          </div>
          <button type="button" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="relative">
          <div className="absolute bottom-0 left-[39px] top-0 hidden w-px bg-border md:block" />

          <div className="space-y-6">
            {upcomingEvents.map((event, index) => {
              const typeInfo = typeLabels[event.type];
              return (
                <div
                  key={event.id}
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
        </div>
      </div>
    </div>
  );
}
