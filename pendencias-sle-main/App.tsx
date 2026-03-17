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
import { Page, CteData } from './types';

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    pendencias,
    criticos,
    emBusca,
    tad,
    setPendenciasPage,
    setPendenciasLimit,
    setCriticosPage,
    setCriticosLimit,
    setEmBuscaPage,
    setEmBuscaLimit,
    setTadPage,
    setTadLimit,
    hasPermission,
  } = useData();
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [selectedCte, setSelectedCte] = useState<CteData | null>(null);

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case Page.DASHBOARD:
        return <Dashboard />;
      case Page.PENDENCIAS:
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
      case Page.MUDAR_SENHA:
        return <ChangePassword />;
      default:
        return <div>Em desenvolvimento...</div>;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AlertOverlay onOpenCte={setSelectedCte} />
      <Sidebar currentPage={currentPage} setPage={setCurrentPage} logout={logout} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b h-16 flex items-center justify-between px-6 pl-20 md:px-6 shadow-sm z-10">
          <h2 className="font-semibold text-gray-700 uppercase tracking-wide truncate">
            {currentPage.replace('_', ' ')}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden md:inline">Olá, <span className="font-bold text-primary-700">{user.username}</span></span>
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
              {user.username[0]}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
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