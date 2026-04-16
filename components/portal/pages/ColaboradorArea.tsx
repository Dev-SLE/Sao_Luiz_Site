'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Clock, CalendarDays, FileText, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const tabs = [
  { id: 'perfil' as const, label: 'Meu Perfil', icon: User, href: '/perfil' },
  { id: 'ponto' as const, label: 'Consulta de Ponto', icon: Clock, href: '/meu-ponto' },
  { id: 'escala' as const, label: 'Escala de Trabalho', icon: CalendarDays, href: '/minha-escala' },
  { id: 'holerite' as const, label: 'Holerites', icon: FileText, href: '/holerite' },
  { id: 'notificacoes' as const, label: 'Notificações', icon: Bell, href: '/notificacoes' },
] as const;

export type ColaboradorTab = (typeof tabs)[number]['id'];

type Props = { initialTab: ColaboradorTab };

function EmptyRhPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
      <div className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

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
                Área do colaborador · Ponto, escala e holerite dependem de integração com DP/RH (fora do escopo do CMS do
                portal).
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
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {activeTab === 'perfil' && (
              <div className="rounded-2xl border border-border bg-card p-8">
                <h2 className="mb-6 font-heading text-xl font-bold text-foreground">Dados da sessão</h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[
                    { label: 'Nome de usuário', value: displayName },
                    { label: 'Perfil (papel)', value: user?.role || '—' },
                    { label: 'Unidade origem', value: user?.linkedOriginUnit || '—' },
                    { label: 'Unidade destino', value: user?.linkedDestUnit || '—' },
                    { label: 'E-mail corporativo', value: '—' },
                    { label: 'Telefone', value: '—' },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {field.label}
                      </label>
                      <p className="mt-1 font-medium text-foreground">{field.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-xs text-muted-foreground">
                  E-mail e telefone completos serão preenchidos quando o cadastro do colaborador for integrado ao sistema de
                  identidade / RH.
                </p>
              </div>
            )}

            {activeTab === 'ponto' && (
              <EmptyRhPanel title="Consulta de ponto">
                <p>
                  Não há registros carregados aqui. Quando a API de ponto estiver disponível, os lançamentos aparecerão nesta
                  lista.
                </p>
              </EmptyRhPanel>
            )}

            {activeTab === 'escala' && (
              <EmptyRhPanel title="Escala de trabalho">
                <p>A escala exibida virá do mesmo módulo de RH/operacional; ainda não há dados conectados a esta tela.</p>
              </EmptyRhPanel>
            )}

            {activeTab === 'holerite' && (
              <EmptyRhPanel title="Holerites">
                <p>Demonstrativos de pagamento não são armazenados no CMS do portal. Use o canal oficial da empresa quando o módulo financeiro estiver integrado.</p>
              </EmptyRhPanel>
            )}

            {activeTab === 'notificacoes' && (
              <EmptyRhPanel title="Notificações">
                <p>Sem notificações de sistema neste momento. Avisos institucionais continuam em Comunicados e no mural.</p>
                <Link href="/comunicados" className="mt-4 inline-block text-sm font-semibold text-sl-red hover:text-sl-red-light">
                  Ir aos comunicados
                </Link>
              </EmptyRhPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
