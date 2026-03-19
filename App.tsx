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
  const [profileOpen, setProfileOpen] = useState(false);

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
        return (
          <CrmFunnel
            onGoToChat={(leadId: string) => {
              setSelectedCrmLeadId(leadId);
              setCurrentPage(Page.CRM_CHAT);
            }}
          />
        );
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
        return <CrmChat leadId={selectedCrmLeadId} />;
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
    <div className="flex h-screen bg-[#050511] text-white overflow-hidden">
      <AlertOverlay onOpenCte={setSelectedCte} />
      <Sidebar currentPage={currentPage} setPage={setCurrentPage} logout={logout} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="relative z-10 h-16 flex items-center justify-between px-4 md:px-8 bg-[#080816]/95 border-b border-[#151745] shadow-[0_10px_30px_rgba(0,0,0,0.7)] backdrop-blur">
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
                className="group flex items-center gap-3 rounded-full bg-[#0F103A] border border-[#1A1B62] px-3 pl-1 py-1 shadow-[0_0_18px_rgba(0,0,0,0.6)] hover:border-[#EC1B23] hover:shadow-[0_0_25px_rgba(236,27,35,0.55)] transition-all"
              >
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#EC1B23] to-[#FF4D4D] flex items-center justify-center text-xs font-black text-white shadow-[0_0_20px_rgba(236,27,35,0.75)]">
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
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#050511] border border-[#151745] shadow-[0_18px_45px_rgba(0,0,0,0.9)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#151745] bg-gradient-to-r from-[#080816] via-[#080816] to-[#131437]">
                    <p className="text-xs font-semibold text-gray-300">Conectado como</p>
                    <p className="text-sm font-bold text-white truncate">{user.username}</p>
                  </div>
                  <div className="py-2">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-200 hover:bg-[#0F103A] transition-colors"
                      onClick={() => setProfileOpen(false)}
                    >
                      <UserIcon size={16} className="text-[#6E71DA]" />
                      <span>Meu Perfil</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-200 hover:bg-[#0F103A] transition-colors"
                      onClick={() => {
                        setCurrentPage(Page.MUDAR_SENHA);
                        setProfileOpen(false);
                      }}
                    >
                      <KeyRound size={16} className="text-[#FFB347]" />
                      <span>Alterar Senha</span>
                    </button>
                  </div>
                  <div className="border-t border-[#151745]">
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

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth bg-gradient-to-br from-[#050511] via-[#050511] to-[#080816]">
          <div className="max-w-7xl mx-auto w-full">
            {renderPage()}
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