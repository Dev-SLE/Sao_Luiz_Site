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
import { Page, CteData } from './types';
import OperationalTracking from './components/OperationalTracking';
import { ChevronDown, CircleDot, LogOut, KeyRound, User as UserIcon } from 'lucide-react';

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

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case Page.DASHBOARD:
        if (!hasPermission('VIEW_DASHBOARD')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso ao Dashboard Operacional.
              </p>
            </div>
          );
        }
        return <Dashboard />;
      case Page.PENDENCIAS:
        if (!hasPermission('VIEW_PENDENCIAS')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso ao Painel de Pendências.
              </p>
            </div>
          );
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
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso às Pendências Críticas.
              </p>
            </div>
          );
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
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso à tela de Mercadorias em Busca.
              </p>
            </div>
          );
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
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso ao Rastreio Operacional.
              </p>
            </div>
          );
        }
        return <OperationalTracking initialCte={selectedTrackingCte} initialSerie={selectedTrackingSerie} />;
      case Page.TAD:
        if (!hasPermission('VIEW_TAD')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso à tela de Processos TAD.
              </p>
            </div>
          );
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
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso à tela de Concluídos.
              </p>
            </div>
          );
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
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso ao Dashboard CRM.
              </p>
            </div>
          );
        }
        return <CrmDashboard />;
      case Page.CRM_FUNIL:
        if (!hasPermission('VIEW_CRM_FUNIL')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso ao Funil CRM.
              </p>
            </div>
          );
        }
        return null;
      case Page.CRM_CHAT:
        if (!hasPermission('VIEW_CRM_CHAT')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso ao Chat CRM.
              </p>
            </div>
          );
        }
        return null;
      case Page.CONFIGURACOES:
        if (!hasPermission('MANAGE_SETTINGS')) {
          return (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Sem permissão</h3>
              <p className="text-sm text-slate-600 mt-1">
                Seu perfil não possui acesso a Configurações.
              </p>
            </div>
          );
        }
        return <Settings />;
      case Page.SOFIA_CONFIG:
        if (!hasPermission('MANAGE_SETTINGS') || !hasPermission('MANAGE_SOFIA')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso às Configurações da Sofia.
              </p>
            </div>
          );
        }
        return <SofiaSettings />;
      case Page.RELATORIOS:
        if (!hasPermission('VIEW_RELATORIOS') && !hasPermission('MANAGE_SETTINGS')) {
          return (
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso aos Relatórios.
              </p>
            </div>
          );
        }
        return <Reports />;
      case Page.MUDAR_SENHA:
        return <ChangePassword onClose={() => setCurrentPage(Page.DASHBOARD)} />;
      default:
        return <div>Em desenvolvimento...</div>;
    }
  };

  return (
    <div className="flex h-screen bg-[#070B1A] text-white overflow-hidden">
      <AlertOverlay onOpenCte={setSelectedCte} />
      <Sidebar currentPage={currentPage} setPage={setCurrentPage} logout={logout} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="relative z-10 h-16 flex items-center justify-between px-4 md:px-8 bg-[#0B1226]/90 border-b border-[#1E2A44] shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden md:flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#6E71DA]">
                São Luiz Express
              </span>
              <h2 className="text-sm md:text-base font-bold text-white/90 truncate">
                {currentPage.replace('_', ' ')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="group flex items-center gap-3 rounded-full bg-[#101A33] border border-[#233456] px-3 pl-1 py-1 shadow-[0_6px_16px_rgba(0,0,0,0.35)] hover:border-[#38598A] transition-all"
              >
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#304B7A] to-[#22385C] flex items-center justify-center text-xs font-black text-white">
                    {user.username[0]?.toUpperCase?.() || <CircleDot size={14} />}
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-[11px] text-gray-300 leading-tight">Olá,</span>
                  <span className="text-xs font-semibold text-white leading-tight truncate max-w-[140px]">
                    {user.username}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className="text-gray-400 group-hover:text-white transition-transform"
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#0A1021] border border-[#1F2D49] shadow-[0_16px_32px_rgba(0,0,0,0.45)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1F2D49] bg-[#101A33]">
                    <p className="text-xs font-semibold text-gray-300">Conectado como</p>
                    <p className="text-sm font-bold text-white truncate">{user.username}</p>
                  </div>
                  <div className="py-2">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-200 hover:bg-[#121D39] transition-colors"
                      onClick={() => setProfileOpen(false)}
                    >
                      <UserIcon size={16} className="text-[#6E71DA]" />
                      <span>Meu Perfil</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-200 hover:bg-[#121D39] transition-colors"
                      onClick={() => {
                        setCurrentPage(Page.MUDAR_SENHA);
                        setProfileOpen(false);
                      }}
                    >
                      <KeyRound size={16} className="text-[#FFB347]" />
                      <span>Alterar Senha</span>
                    </button>
                  </div>
                  <div className="border-t border-[#1F2D49]">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-300 hover:bg-[#220911] hover:text-red-100 transition-colors"
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
        </header>

        <div className={isCrmPage ? "flex-1 overflow-hidden p-4 md:p-6 bg-gradient-to-br from-[#070B1A] via-[#0A1124] to-[#0B1328]" : "flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth bg-gradient-to-br from-[#070B1A] via-[#0A1124] to-[#0B1328]"}>
          <div className={isCrmPage ? "max-w-7xl mx-auto w-full h-full min-h-0" : "max-w-7xl mx-auto w-full"}>
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