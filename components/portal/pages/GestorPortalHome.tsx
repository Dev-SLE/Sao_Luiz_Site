'use client';

import Link from 'next/link';
import { Users, CalendarDays, CheckSquare, ClipboardList, Megaphone, LineChart, Inbox } from 'lucide-react';

const sections = [
  { href: '/gestor/equipe', label: 'Minha equipe', icon: Users, perm: 'portal.gestor.equipe.view' },
  { href: '/gestor/escalas', label: 'Escalas da equipe', icon: CalendarDays, perm: 'portal.gestor.escalas.view' },
  { href: '/gestor/aprovacoes', label: 'Aprovações', icon: CheckSquare, perm: 'portal.gestor.aprovacoes.view' },
  { href: '/gestor/pendencias', label: 'Pendências do setor', icon: ClipboardList, perm: 'portal.gestor.pendencias_setor.view' },
  { href: '/gestor/comunicados', label: 'Comunicados do setor', icon: Megaphone, perm: 'portal.gestor.comunicados_setor.view' },
  { href: '/gestor/indicadores', label: 'Indicadores rápidos', icon: LineChart, perm: 'portal.gestor.indicadores.view' },
  { href: '/gestor/solicitacoes', label: 'Solicitações do time', icon: Inbox, perm: 'portal.gestor.solicitacoes_time.view' },
];

export function GestorPortalHome() {
  return (
    <div className="min-h-screen bg-background px-6 pb-20 pt-28">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-sl-red">Portal do gestor</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">Ferramentas de equipe</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Área intermediária entre o portal do colaborador e o sistema. Cada seção respeita as permissões{' '}
          <code className="rounded bg-muted px-1 text-xs">portal.gestor.*</code>. Conteúdo operacional será integrado
          nas próximas entregas.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-sl-red/30 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sl-red/10 text-sl-red transition-colors group-hover:bg-sl-red group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading font-semibold text-foreground">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Abrir área (stub com dados de exemplo em seguida)</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
