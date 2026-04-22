'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Page, CteData } from '@/types';
import { parseWorkspacePath } from '@/lib/workspace-routes';
import { useData } from '@/context/DataContext';
import Settings from '@/components/Settings';
import SofiaSettings from '@/components/SofiaSettings';
import Reports from '@/components/Reports';
import ChangePassword from '@/components/ChangePassword';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';
import { canAccessOperacionalUtilityPath, isOperacionalUtilityPath } from './routes';
import { VisaoGeralPage } from './pages/VisaoGeral';
import { PendenciasPage } from './pages/Pendencias';
import { CriticosPage } from './pages/Criticos';
import { EmBuscaPage } from './pages/EmBusca';
import { OcorrenciasPage } from './pages/Ocorrencias';
import { RastreioPage } from './pages/Rastreio';
import { ConcluidosPage } from './pages/Concluidos';

export type OperacionalModuleProps = {
  pathname: string;
  onNoteClick: (cte: CteData) => void;
  navigateToPage: (p: Page) => void;
  tracking: { cte: string | null; serie: string | null };
};

function RedirectToGerencialDesempenhoAgencias() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/gerencial/operacao/desempenho-agencias');
  }, [router]);
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-600">
      <p>A central de desempenho de agências foi movida para o hub Gerencial.</p>
      <p className="text-slate-500">A redirecionar para Operação (BI)…</p>
    </div>
  );
}

function RedirectToGerencialRotasOperacionais() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/gerencial/operacao/rotas-operacionais');
  }, [router]);
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-600">
      <p>O painel de rotas operacionais está no hub Gerencial → Operação.</p>
      <p className="text-slate-500">A redirecionar…</p>
    </div>
  );
}

export function OperacionalModule({ pathname, onNoteClick, navigateToPage, tracking }: OperacionalModuleProps) {
  const { hasPermission } = useData();
  const { rest } = parseWorkspacePath(pathname);
  const r0 = rest[0]?.toLowerCase() ?? '';

  const canEnterOperacional =
    hasPermission('module.operacional.view') ||
    hasPermission('VIEW_DASHBOARD') ||
    hasPermission('VIEW_PENDENCIAS') ||
    hasPermission('VIEW_CRITICOS') ||
    hasPermission('VIEW_EM_BUSCA') ||
    hasPermission('tab.operacional.ocorrencias.view') ||
    hasPermission('VIEW_RASTREIO_OPERACIONAL') ||
    hasPermission('VIEW_CONCLUIDOS') ||
    hasPermission('VIEW_RELATORIOS') ||
    hasPermission('MANAGE_SOFIA');

  const utilityPath = isOperacionalUtilityPath(pathname);
  const utilityAllowed = utilityPath && canAccessOperacionalUtilityPath(pathname, hasPermission);

  if (!canEnterOperacional && !utilityAllowed) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao módulo Operacional." />;
  }

  let body: React.ReactNode = null;

  if (pathname.endsWith('/configuracoes')) {
    if (!hasPermission('MANAGE_SETTINGS')) {
      body = (
        <WorkspaceNoAccess message="Apenas perfis com permissão 'Configurações e logs' (MANAGE_SETTINGS) podem aceder a esta área." />
      );
    } else {
      body = <Settings />;
    }
  } else if (pathname.endsWith('/relatorios')) {
    if (!hasPermission('VIEW_RELATORIOS')) {
      body = <WorkspaceNoAccess message="Seu perfil não possui acesso aos Relatórios." />;
    } else {
      body = <Reports />;
    }
  } else if (pathname.endsWith('/sofia-config')) {
    if (!hasPermission('MANAGE_SETTINGS') || !hasPermission('MANAGE_SOFIA')) {
      body = <WorkspaceNoAccess message="Seu perfil não possui acesso às Configurações da Sofia." />;
    } else {
      body = <SofiaSettings />;
    }
  } else if (pathname.endsWith('/mudar-senha')) {
    body = <ChangePassword onClose={() => navigateToPage(Page.DASHBOARD)} />;
  } else {
    switch (r0) {
      case '':
      case 'visao-geral':
      case 'dashboard':
        body = <VisaoGeralPage />;
        break;
      case 'pendencias':
        body = <PendenciasPage onNoteClick={onNoteClick} />;
        break;
      case 'criticos':
        body = <CriticosPage onNoteClick={onNoteClick} />;
        break;
      case 'em-busca':
        body = <EmBuscaPage onNoteClick={onNoteClick} />;
        break;
      case 'ocorrencias':
        body = <OcorrenciasPage onNoteClick={onNoteClick} />;
        break;
      case 'rastreio':
      case 'rastreio-operacional':
        body = <RastreioPage initialCte={tracking.cte} initialSerie={tracking.serie} />;
        break;
      case 'concluidos':
        body = <ConcluidosPage onNoteClick={onNoteClick} />;
        break;
      case 'desempenho-agencias':
        body = <RedirectToGerencialDesempenhoAgencias />;
        break;
      case 'rotas-operacionais':
        body = <RedirectToGerencialRotasOperacionais />;
        break;
      default:
        body = <VisaoGeralPage />;
    }
  }

  return (
    <div
      key={pathname}
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200 motion-reduce:animate-none"
    >
      {body}
    </div>
  );
}
