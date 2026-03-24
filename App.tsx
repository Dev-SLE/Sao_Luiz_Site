import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider as GlobalDataProvider, useData } from './context/DataContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DataTable from './components/DataTable';
import NoteModal from './components/NoteModal';
import ChangePassword from './components/ChangePassword';
import AlertOverlay from './components/AlertOverlay';
import Settings from './components/Settings';
import SofiaSettings from './components/SofiaSettings';
import CrmDashboard from './components/CrmDashboard';
import CrmFunnel from './components/CrmFunnel.tsx';
import CrmChat from './components/CrmChat.tsx';
import Reports from './components/Reports';
import ComercialAuditoria from './components/ComercialAuditoria';
import ComercialRoboSupremo from './components/ComercialRoboSupremo';
import { Page, CteData } from './types';
import OperationalTracking from './components/OperationalTracking';
import { ChevronDown, CircleDot, LogOut, KeyRound, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    pendencias,
    criticos,
    emBusca,
    tad,
    concluidos,
    setPendenciasPage,
    setPendenciasLimit,
    setCriticosPage,
    setCriticosLimit,
    setEmBuscaPage,
    setEmBuscaLimit,
    setTadPage,
    setTadLimit,
    setConcluidosPage,
    setConcluidosLimit,
    hasPermission,
  } = useData();
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [selectedCte, setSelectedCte] = useState<CteData | null>(null);
  const [selectedCrmLeadId, setSelectedCrmLeadId] = useState<string | null>(null);
  const [selectedTrackingCte, setSelectedTrackingCte] = useState<string | null>(null);
  const [selectedTrackingSerie, setSelectedTrackingSerie] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const isCrmPage = currentPage === Page.CRM_FUNIL || currentPage === Page.CRM_CHAT;

  const noAccess = (message: string) => (
    <div className="surface-card p-6">
      <h3 className="text-lg font-bold text-slate-900">Sem permissão</h3>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
    </div>
  );

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case Page.DASHBOARD:
        if (!hasPermission('VIEW_DASHBOARD')) {
          return noAccess('Seu perfil não possui acesso ao Dashboard Operacional.');
        }
        return <Dashboard />;
      case Page.PENDENCIAS:
        if (!hasPermission('VIEW_PENDENCIAS')) {
          return noAccess('Seu perfil não possui acesso ao Painel de Pendências.');
        }
        return (
          <DataTable 
            title="Painel de Pendências" 
            data={pendencias.data}
            onNoteClick={setSelectedCte}
            isPendencyView={true}
            serverPagination={{
              page: pendencias.page,
              limit: pendencias.limit,
              total: pendencias.total,
              onPageChange: setPendenciasPage,
              onLimitChange: setPendenciasLimit,
            }}
          />
        );
      case Page.CRITICOS:
        if (!hasPermission('VIEW_CRITICOS')) {
          return noAccess('Seu perfil não possui acesso às Pendências Críticas.');
        }
        return (
          <DataTable 
            title="Pendências Críticas" 
            data={criticos.data}
            onNoteClick={setSelectedCte}
            enableFilters={true}
            isCriticalView={true}
            serverPagination={{
              page: criticos.page,
              limit: criticos.limit,
              total: criticos.total,
              onPageChange: setCriticosPage,
              onLimitChange: setCriticosLimit,
            }}
          />
        );
      case Page.EM_BUSCA:
        if (!hasPermission('VIEW_EM_BUSCA')) {
          return noAccess('Seu perfil não possui acesso à tela de Mercadorias em Busca.');
        }
        return (
           <DataTable 
            title="Mercadorias em Busca" 
            data={emBusca.data}
            onNoteClick={setSelectedCte}
            enableFilters={true}
            ignoreUnitFilter={true}
            serverPagination={{
              page: emBusca.page,
              limit: emBusca.limit,
              total: emBusca.total,
              onPageChange: setEmBuscaPage,
              onLimitChange: setEmBuscaLimit,
            }}
          />
        );
      case Page.RASTREIO_OPERACIONAL:
        if (!hasPermission('VIEW_RASTREIO_OPERACIONAL')) {
          return noAccess('Seu perfil não possui acesso ao Rastreio Operacional.');
        }
        return <OperationalTracking initialCte={selectedTrackingCte} initialSerie={selectedTrackingSerie} />;
      case Page.TAD:
        if (!hasPermission('VIEW_TAD')) {
          return noAccess('Seu perfil não possui acesso à tela de Processos TAD.');
        }
        return (
           <DataTable 
            title="Processo TAD" 
            data={tad.data}
            onNoteClick={setSelectedCte}
            enableFilters={true}
            ignoreUnitFilter={true}
            serverPagination={{
              page: tad.page,
              limit: tad.limit,
              total: tad.total,
              onPageChange: setTadPage,
              onLimitChange: setTadLimit,
            }}
          />
        );
      case Page.CONCLUIDOS:
        if (!hasPermission('VIEW_CONCLUIDOS')) {
          return noAccess('Seu perfil não possui acesso à tela de Concluídos.');
        }
        return (
          <DataTable
            title="Concluídos"
            data={concluidos.data}
            onNoteClick={setSelectedCte}
            enableFilters={true}
            serverPagination={{
              page: concluidos.page,
              limit: concluidos.limit,
              total: concluidos.total,
              onPageChange: setConcluidosPage,
              onLimitChange: setConcluidosLimit,
            }}
          />
        );
      case Page.CRM_DASHBOARD:
        if (!hasPermission('VIEW_CRM_DASHBOARD')) {
          return noAccess('Seu perfil não possui acesso ao Dashboard CRM.');
        }
        return <CrmDashboard />;
      case Page.CRM_FUNIL:
        if (!hasPermission('VIEW_CRM_FUNIL')) {
          return noAccess('Seu perfil não possui acesso ao Funil CRM.');
        }
        return null;
      case Page.CRM_CHAT:
        if (!hasPermission('VIEW_CRM_CHAT')) {
          return noAccess('Seu perfil não possui acesso ao Chat CRM.');
        }
        return null;
      case Page.CONFIGURACOES:
        if (!hasPermission('MANAGE_SETTINGS')) {
          return noAccess('Seu perfil não possui acesso a Configurações.');
        }
        return <Settings />;
      case Page.SOFIA_CONFIG:
        if (!hasPermission('MANAGE_SETTINGS') || !hasPermission('MANAGE_SOFIA')) {
          return noAccess('Seu perfil não possui acesso às Configurações da Sofia.');
        }
        return <SofiaSettings />;
      case Page.RELATORIOS:
        if (!hasPermission('VIEW_RELATORIOS') && !hasPermission('MANAGE_SETTINGS')) {
          return noAccess('Seu perfil não possui acesso aos Relatórios.');
        }
        return <Reports />;
      case Page.COMERCIAL_AUDITORIA:
        if (!hasPermission('VIEW_RELATORIOS') && !hasPermission('MANAGE_SETTINGS')) {
          return noAccess('Seu perfil não possui acesso ao módulo Comercial.');
        }
        return <ComercialAuditoria />;
      case Page.COMERCIAL_ROBO_SUPREMO:
        if (!hasPermission('VIEW_RELATORIOS') && !hasPermission('MANAGE_SETTINGS')) {
          return noAccess('Seu perfil não possui acesso ao Robô Supremo.');
        }
        return <ComercialRoboSupremo />;
      case Page.MUDAR_SENHA:
        return <ChangePassword onClose={() => setCurrentPage(Page.DASHBOARD)} />;
      default:
        return (
          <div className="surface-card p-8 text-center text-slate-600">
            Em desenvolvimento…
          </div>
        );
    }
  };

  return (
    <div className="app-typography flex h-screen overflow-hidden bg-[#cfd9e8] text-slate-900">
      <AlertOverlay onOpenCte={setSelectedCte} />
      <Sidebar currentPage={currentPage} setPage={setCurrentPage} logout={logout} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-[4.25rem] shrink-0 items-stretch justify-between overflow-visible px-4 backdrop-blur-md md:px-8 sle-header-shell">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(920px_140px_at_50%_-50px,rgba(44,52,140,0.16),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-px bg-gradient-to-r from-transparent via-[#e42424]/45 to-transparent" />
          <div className="pointer-events-none absolute right-[10%] top-[-55%] z-0 h-36 w-36 rounded-full bg-[#e42424]/22 blur-2xl fx-orbit-rev" />
          <div className="pointer-events-none absolute left-[18%] top-1/2 z-0 h-28 w-28 -translate-y-1/2 rounded-full bg-[#2c348c]/18 blur-2xl fx-drift-slow" />
          <div className="relative z-10 flex w-full min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 pl-12 md:pl-0">
            <div className="hidden min-w-0 md:flex md:flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#2c348c] drop-shadow-sm">
                São Luiz Express
              </span>
              <h2 className="truncate text-sm font-bold text-[#06183e] md:text-base">
                {currentPage.replace('_', ' ')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative z-50">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="group interactive-lift flex items-center gap-3 rounded-full border border-[#2c348c]/25 bg-gradient-to-b from-white to-[#eef3ff] px-3 py-1 pl-1 shadow-[0_4px_16px_rgba(44,52,140,0.12)] hover:border-[#e42424]/35"
              >
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2c348c] to-[#06183e] text-xs font-black text-white">
                    {user.username[0]?.toUpperCase?.() || <CircleDot size={14} />}
                  </div>
                </div>
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-[11px] leading-tight text-slate-500">Olá,</span>
                  <span className="max-w-[140px] truncate text-xs font-semibold leading-tight text-slate-800">
                    {user.username}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className="text-slate-400 transition-transform group-hover:text-[#2c348c]"
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[#2c348c]/20 bg-white shadow-xl shadow-slate-400/25">
                  <div className="border-b border-[#2c348c]/10 bg-gradient-to-r from-[#f8faff] to-[#eef3ff] px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">Conectado como</p>
                    <p className="truncate text-sm font-bold text-slate-900">{user.username}</p>
                  </div>
                  <div className="py-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      <UserIcon size={16} className="text-[#2c348c]" />
                      <span>Meu Perfil</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => {
                        setCurrentPage(Page.MUDAR_SENHA);
                        setProfileOpen(false);
                      }}
                    >
                      <KeyRound size={16} className="text-amber-600" />
                      <span>Alterar Senha</span>
                    </button>
                  </div>
                  <div className="border-t border-slate-100">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-red-600 transition-colors hover:bg-red-50"
                      onClick={async () => {
                        setProfileOpen(false);
                        await logout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </header>

        <div
          className={clsx(
            'sle-app-main flex-1 min-h-0',
            isCrmPage ? 'overflow-hidden p-4 md:p-6' : 'overflow-y-auto scroll-smooth p-4 md:p-6',
          )}
        >
          <div
            className={clsx(
              'mx-auto w-full',
              isCrmPage ? 'flex h-full min-h-0 max-w-[1600px] flex-col' : 'max-w-[1600px]',
            )}
          >
            {renderPage()}
            {hasPermission('VIEW_CRM_FUNIL') && hasPermission('VIEW_CRM_CHAT') && (
              <div className={isCrmPage ? "h-full min-h-0" : "hidden"}>
                <div className={currentPage === Page.CRM_FUNIL ? "h-full min-h-0" : "hidden"}>
                  <CrmFunnel
                    onGoToChat={(leadId: string) => {
                      setSelectedCrmLeadId(leadId);
                      setCurrentPage(Page.CRM_CHAT);
                    }}
                    onOpenTracking={(cte: string, serie?: string) => {
                      setSelectedTrackingCte(cte);
                      setSelectedTrackingSerie(serie || null);
                      setCurrentPage(Page.RASTREIO_OPERACIONAL);
                    }}
                  />
                </div>
                <div className={currentPage === Page.CRM_CHAT ? "h-full min-h-0" : "hidden"}>
                  <CrmChat
                    leadId={selectedCrmLeadId}
                    onOpenTracking={(cte: string, serie?: string) => {
                      setSelectedTrackingCte(cte);
                      setSelectedTrackingSerie(serie || null);
                      setCurrentPage(Page.RASTREIO_OPERACIONAL);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedCte && (
        <NoteModal cte={selectedCte} onClose={() => setSelectedCte(null)} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <GlobalDataProvider>
        <AppContent />
      </GlobalDataProvider>
    </AuthProvider>
  );
};

export default App;