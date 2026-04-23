'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { Page } from '@/types';
import { pathToPage } from '@/lib/workspace-routes';
import { useData } from '@/context/DataContext';

const CrmDashboard = dynamic(() => import('@/components/CrmDashboard'), {
  ssr: false,
  loading: () => (
    <div className="surface-card mx-auto max-w-3xl p-6 text-center text-sm text-slate-600">A carregar dashboard…</div>
  ),
});
import CrmOpsAdmin from '@/components/CrmOpsAdmin';
import CrmMyTasks from '@/components/CrmMyTasks';
import CrmReports from '@/components/CrmReports';
import CrmContact360 from '@/components/CrmContact360';
import CrmPrivacyHub from '@/components/CrmPrivacyHub';
import CrmFunnel from '@/components/CrmFunnel.tsx';
import CrmChat from '@/components/CrmChat.tsx';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

export type CrmModuleProps = {
  pathname: string;
  selectedCrmLeadId: string | null;
  setSelectedCrmLeadId: (id: string | null) => void;
  navigateToPage: (p: Page) => void;
  onOpenTracking: (cte: string, serie?: string) => void;
};

export function CrmModule({
  pathname,
  selectedCrmLeadId,
  setSelectedCrmLeadId,
  navigateToPage,
  onOpenTracking,
}: CrmModuleProps) {
  const { hasPermission } = useData();
  const page = pathToPage(pathname);

  const canEnterCrm =
    hasPermission('module.crm.view') ||
    hasPermission('VIEW_CRM_DASHBOARD') ||
    hasPermission('VIEW_CRM_FUNIL') ||
    hasPermission('VIEW_CRM_CHAT') ||
    hasPermission('MANAGE_CRM_OPS');

  if (!canEnterCrm) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso ao módulo CRM." />;
  }

  let body: React.ReactNode = null;

  switch (page) {
    case Page.CRM_DASHBOARD:
      if (!hasPermission('VIEW_CRM_DASHBOARD')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso ao Dashboard CRM." />;
      } else {
        body = <CrmDashboard />;
      }
      break;
    case Page.CRM_FUNIL:
      if (!hasPermission('VIEW_CRM_FUNIL')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso ao Funil CRM." />;
      } else {
        body = null;
      }
      break;
    case Page.CRM_CHAT:
      if (!hasPermission('VIEW_CRM_CHAT')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso ao Chat CRM." />;
      } else {
        body = null;
      }
      break;
    case Page.CRM_OPS:
      if (!hasPermission('MANAGE_CRM_OPS')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso à Operação CRM." />;
      } else {
        body = (
          <div className="max-w-6xl min-h-0 w-full flex-1 space-y-4 pb-6">
            <p className="text-xs text-slate-600">
              Times, caixas WhatsApp (Evolution), triagem de contatos, roteamento, SLA, cadências e campanhas. A
              privacidade e trilha de consentimento ficam em <strong>Privacidade CRM</strong> no menu.
            </p>
            <CrmOpsAdmin />
          </div>
        );
      }
      break;
    case Page.CRM_TASKS:
      if (!hasPermission('VIEW_CRM_CHAT')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso a pendências do CRM." />;
      } else {
        body = <CrmMyTasks />;
      }
      break;
    case Page.CRM_REPORTS:
      if (!hasPermission('VIEW_CRM_DASHBOARD')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso aos relatórios CRM." />;
      } else {
        body = <CrmReports />;
      }
      break;
    case Page.CRM_CONTACT_360:
      if (
        !hasPermission('VIEW_CRM_CHAT') &&
        !hasPermission('VIEW_CRM_FUNIL') &&
        !hasPermission('VIEW_CRM_DASHBOARD')
      ) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso ao Contato 360." />;
      } else {
        body = <CrmContact360 />;
      }
      break;
    case Page.CRM_PRIVACY:
      if (!hasPermission('MANAGE_CRM_OPS')) {
        body = <WorkspaceNoAccess message="Seu perfil não possui acesso ao módulo de privacidade CRM." />;
      } else {
        body = <CrmPrivacyHub />;
      }
      break;
    default:
      body = hasPermission('VIEW_CRM_DASHBOARD') ? (
        <CrmDashboard />
      ) : (
        <WorkspaceNoAccess message="Rota CRM não reconhecida." />
      );
  }

  const funnelChat =
    hasPermission('VIEW_CRM_FUNIL') && hasPermission('VIEW_CRM_CHAT') ? (
      <div className={page === Page.CRM_FUNIL || page === Page.CRM_CHAT ? 'h-full min-h-0' : 'hidden'}>
        <div className={page === Page.CRM_FUNIL ? 'h-full min-h-0' : 'hidden'}>
          <CrmFunnel
            onGoToChat={(leadId: string) => {
              setSelectedCrmLeadId(leadId);
              navigateToPage(Page.CRM_CHAT);
            }}
            onOpenTracking={onOpenTracking}
          />
        </div>
        <div className={page === Page.CRM_CHAT ? 'h-full min-h-0' : 'hidden'}>
          <CrmChat leadId={selectedCrmLeadId} onOpenTracking={onOpenTracking} />
        </div>
      </div>
    ) : null;

  const isDense = page === Page.CRM_FUNIL || page === Page.CRM_CHAT;

  return (
    <div
      key={pathname}
      className={clsx(
        isDense ? 'flex h-full min-h-0 flex-col' : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden',
      )}
    >
      <div className={clsx(isDense ? 'flex h-full min-h-0 flex-col' : 'flex min-h-0 min-w-0 flex-1 flex-col')}>
        {body}
        {funnelChat}
      </div>
    </div>
  );
}
