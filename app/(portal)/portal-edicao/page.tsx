'use client';

import { useState } from 'react';
import { LayoutGrid, CalendarDays } from 'lucide-react';
import clsx from 'clsx';
import { PortalCmsEditorBody } from '@/components/portal/PortalCmsEditorBody';
import { PortalAgendaEditor } from '@/components/portal/PortalAgendaEditor';
import { canEditPortalContent } from '@/lib/portalEditorAccess';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

type Tab = 'content' | 'agenda';

export default function PortalEdicaoPage() {
  const { user } = useAuth();
  const { hasPermission } = useData();
  const [tab, setTab] = useState<Tab>('content');
  const ok = canEditPortalContent(hasPermission, { role: user?.role, username: user?.username });

  if (!ok) {
    return (
      <div className="mx-auto max-w-lg px-6 py-28 text-center">
        <h1 className="font-heading text-xl font-bold text-foreground">Edição do portal</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Você não tem permissão para esta área. Solicite ao administrador a permissão{' '}
          <code className="rounded bg-muted px-1 text-xs">portal.colaborador.editor</code> (comunicação / RH) ou{' '}
          <code className="rounded bg-muted px-1 text-xs">portal.gestor.content.manage</code>.
        </p>
        <Link href="/inicio" className="mt-6 inline-block text-sm font-semibold text-sl-red underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pb-20 pt-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-sl-red">Portal do colaborador</p>
            <h1 className="mt-1 font-heading text-3xl font-bold text-foreground">Edição rápida</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Publique banners, notícias, treinamentos e documentos sem abrir o SharePoint. A agenda corporativa também é
              editada aqui.
            </p>
          </div>
          <Link href="/agenda" className="text-sm font-semibold text-sl-navy underline">
            Ver agenda pública
          </Link>
        </div>

        <div className="mb-8 flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab('content')}
            className={clsx(
              'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
              tab === 'content' ? 'border-sl-red text-sl-red' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-4 w-4" /> Conteúdo e mídia
          </button>
          <button
            type="button"
            onClick={() => setTab('agenda')}
            className={clsx(
              'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
              tab === 'agenda' ? 'border-sl-red text-sl-red' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <CalendarDays className="h-4 w-4" /> Agenda
          </button>
        </div>

        {tab === 'content' ? <PortalCmsEditorBody /> : <PortalAgendaEditor />}
      </div>
    </div>
  );
}
