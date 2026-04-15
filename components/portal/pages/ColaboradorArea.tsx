'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Clock, CalendarDays, FileText, Bell, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const pontoRecords = [
  { date: '10/04/2026', entrada: '07:58', saida: '17:03', status: 'ok' as const },
  { date: '09/04/2026', entrada: '07:55', saida: '17:01', status: 'ok' as const },
  { date: '08/04/2026', entrada: '08:12', saida: '17:05', status: 'late' as const },
  { date: '07/04/2026', entrada: '07:50', saida: '17:00', status: 'ok' as const },
  { date: '04/04/2026', entrada: '07:59', saida: '16:55', status: 'early' as const },
  { date: '03/04/2026', entrada: '07:57', saida: '17:02', status: 'ok' as const },
  { date: '02/04/2026', entrada: '07:45', saida: '17:00', status: 'ok' as const },
];

const escalaData = [
  { day: 'Seg 07/04', shift: '08:00 - 17:00', type: 'normal' as const },
  { day: 'Ter 08/04', shift: '08:00 - 17:00', type: 'normal' as const },
  { day: 'Qua 09/04', shift: '08:00 - 17:00', type: 'normal' as const },
  { day: 'Qui 10/04', shift: '08:00 - 17:00', type: 'normal' as const },
  { day: 'Sex 11/04', shift: '08:00 - 17:00', type: 'normal' as const },
  { day: 'Sáb 12/04', shift: 'Folga', type: 'off' as const },
  { day: 'Dom 13/04', shift: 'Folga', type: 'off' as const },
  { day: 'Seg 14/04', shift: '06:00 - 15:00', type: 'early' as const },
  { day: 'Ter 15/04', shift: '06:00 - 15:00', type: 'early' as const },
];

const holerites = [
  { month: 'Março 2026', date: '05/04/2026', value: 'R$ 3.250,00', status: 'disponível' },
  { month: 'Fevereiro 2026', date: '05/03/2026', value: 'R$ 3.250,00', status: 'disponível' },
  { month: 'Janeiro 2026', date: '05/02/2026', value: 'R$ 3.450,00', status: 'disponível' },
  { month: 'Dezembro 2025', date: '05/01/2026', value: 'R$ 6.500,00', status: 'disponível' },
];

const notifications = [
  { id: 1, title: 'Seu holerite de Março está disponível', time: 'Há 2 horas', read: false },
  { id: 2, title: 'Escala atualizada para a próxima semana', time: 'Há 5 horas', read: false },
  { id: 3, title: 'Treinamento obrigatório agendado para 14/04', time: 'Ontem', read: true },
  { id: 4, title: 'Campanha de vacinação disponível', time: '2 dias atrás', read: true },
  { id: 5, title: 'Seu registro de ponto do dia 08/04 precisa de justificativa', time: '3 dias atrás', read: false },
];

const tabs = [
  { id: 'perfil' as const, label: 'Meu Perfil', icon: User, href: '/perfil' },
  { id: 'ponto' as const, label: 'Consulta de Ponto', icon: Clock, href: '/meu-ponto' },
  { id: 'escala' as const, label: 'Escala de Trabalho', icon: CalendarDays, href: '/minha-escala' },
  { id: 'holerite' as const, label: 'Holerites', icon: FileText, href: '/holerite' },
  { id: 'notificacoes' as const, label: 'Notificações', icon: Bell, href: '/notificacoes' },
];

export type ColaboradorTab = (typeof tabs)[number]['id'];

type Props = { initialTab: ColaboradorTab };

export function ColaboradorArea({ initialTab }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();

  const activeTab = useMemo<ColaboradorTab>(() => {
    const hit = tabs.find((t) => t.href === pathname);
    return hit?.id ?? initialTab;
  }, [pathname, initialTab]);

  const displayName = user?.username || 'Colaborador';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sl-navy px-6 pb-12 pt-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <span className="font-heading text-2xl font-bold text-white">{initials}</span>
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-white md:text-3xl">{displayName}</h1>
              <p className="text-sm text-white/60">
                Portal do colaborador · Dados de exemplo (integração DP/RH na Fase 2)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="flex-shrink-0 lg:w-64">
            <nav className="overflow-hidden rounded-2xl border border-border bg-card">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`flex w-full items-center gap-3 border-b border-border px-5 py-4 text-sm font-medium transition-colors last:border-b-0 ${
                      isActive ? 'bg-sl-navy text-white' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.id === 'notificacoes' && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-sl-red text-xs font-bold text-white">
                        3
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {activeTab === 'perfil' && (
              <div className="rounded-2xl border border-border bg-card p-8">
                <h2 className="mb-6 font-heading text-xl font-bold text-foreground">Dados pessoais</h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[
                    { label: 'Nome de usuário', value: displayName },
                    { label: 'Perfil (papel)', value: user?.role || '—' },
                    { label: 'Unidade origem', value: user?.linkedOriginUnit || '—' },
                    { label: 'Unidade destino', value: user?.linkedDestUnit || '—' },
                    { label: 'E-mail', value: `${String(user?.username || 'usuario').toLowerCase()}@saoluizexpress.com.br` },
                    { label: 'Telefone', value: '(exemplo) (11) 99999-0000' },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {field.label}
                      </label>
                      <p className="mt-1 font-medium text-foreground">{field.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ponto' && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="font-heading text-xl font-bold text-foreground">Registros de ponto</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Abril 2026 (dados mock)</p>
                </div>
                <div className="divide-y divide-border">
                  {pontoRecords.map((record) => (
                    <div key={record.date} className="flex items-center gap-4 px-6 py-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{record.date}</p>
                        <p className="text-xs text-muted-foreground">
                          Entrada: {record.entrada} · Saída: {record.saida}
                        </p>
                      </div>
                      {record.status === 'ok' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {record.status === 'late' && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-xs font-medium text-amber-600">Atraso</span>
                        </div>
                      )}
                      {record.status === 'early' && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                          <span className="text-xs font-medium text-blue-600">Saída antecipada</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'escala' && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="font-heading text-xl font-bold text-foreground">Escala de trabalho</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Semana atual e próxima (mock)</p>
                </div>
                <div className="divide-y divide-border">
                  {escalaData.map((item) => (
                    <div key={item.day} className="flex items-center gap-4 px-6 py-4">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                          item.type === 'off'
                            ? 'bg-emerald-500/10'
                            : item.type === 'early'
                              ? 'bg-amber-500/10'
                              : 'bg-muted'
                        }`}
                      >
                        <Clock
                          className={`h-4 w-4 ${
                            item.type === 'off'
                              ? 'text-emerald-500'
                              : item.type === 'early'
                                ? 'text-amber-500'
                                : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.day}</p>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          item.type === 'off'
                            ? 'text-emerald-600'
                            : item.type === 'early'
                              ? 'text-amber-600'
                              : 'text-foreground'
                        }`}
                      >
                        {item.shift}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'holerite' && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="font-heading text-xl font-bold text-foreground">Holerites</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Demonstrativos de pagamento (mock)</p>
                </div>
                <div className="divide-y divide-border">
                  {holerites.map((h) => (
                    <div
                      key={h.month}
                      className="flex cursor-pointer items-center gap-4 px-6 py-5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sl-red/10">
                        <FileText className="h-5 w-5 text-sl-red" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{h.month}</p>
                        <p className="text-xs text-muted-foreground">Disponível em {h.date}</p>
                      </div>
                      <span className="text-sm font-bold text-foreground">{h.value}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notificacoes' && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="font-heading text-xl font-bold text-foreground">Notificações</h2>
                </div>
                <div className="divide-y divide-border">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex cursor-pointer items-start gap-4 px-6 py-5 transition-colors ${
                        n.read ? 'hover:bg-muted/50' : 'bg-sl-red/[0.02] hover:bg-sl-red/[0.05]'
                      }`}
                    >
                      {!n.read && <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-sl-red" />}
                      <div className={`flex-1 ${n.read ? 'ml-6' : ''}`}>
                        <p
                          className={`text-sm leading-snug ${
                            n.read ? 'text-muted-foreground' : 'font-medium text-foreground'
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
