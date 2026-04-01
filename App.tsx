import React, { useEffect, useState } from 'react';
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
import OcorrenciasHub from './components/OcorrenciasHub';
import { ChevronDown, CircleDot, LogOut, KeyRound, User as UserIcon, Bell, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { authClient } from './lib/auth';

const AppContent: React.FC = () => {
  const { user, logout, loading } = useAuth();
  const {
    pendencias,
    criticos,
    emBusca,
    ocorrencias,
    concluidos,
    setPendenciasPage,
    setPendenciasLimit,
    setCriticosPage,
    setCriticosLimit,
    setEmBuscaPage,
    setEmBuscaLimit,
    setOcorrenciasPage,
    setOcorrenciasLimit,
    setConcluidosPage,
    setConcluidosLimit,
    hasPermission,
  } = useData();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (typeof window === 'undefined') return Page.DASHBOARD;
    const saved = window.localStorage.getItem('sle_current_page');
    const values = Object.values(Page) as string[];
    if (saved && values.includes(saved)) return saved as Page;
    return Page.DASHBOARD;
  });
  const [selectedCte, setSelectedCte] = useState<CteData | null>(null);
  const [selectedCrmLeadId, setSelectedCrmLeadId] = useState<string | null>(null);
  const [selectedTrackingCte, setSelectedTrackingCte] = useState<string | null>(null);
  const [selectedTrackingSerie, setSelectedTrackingSerie] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [themeDark, setThemeDark] = useState(false);
  const isCrmPage = currentPage === Page.CRM_FUNIL || currentPage === Page.CRM_CHAT;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sle_current_page', currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem("sle_theme_dark");
    const enabled = v === "1";
    setThemeDark(enabled);
    document.documentElement.classList.toggle("sle-theme-dark", enabled);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("sle-theme-dark", themeDark);
    window.localStorage.setItem("sle_theme_dark", themeDark ? "1" : "0");
  }, [themeDark]);

  useEffect(() => {
    if (!user || !hasPermission('module.operacional.view')) return;
    let cancelled = false;
    const run = async () => {
      try {
        const resp = await authClient.getOperationalNotifications({ limit: 20 });
        if (cancelled) return;
        setNotifications(Array.isArray(resp?.items) ? resp.items : []);
        setNotificationsUnread(Number(resp?.unreadCount || 0));
      } catch {
        // noop
      }
    };
    run();
    const id = window.setInterval(run, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, hasPermission]);

  const noAccess = (message: string) => (
    <div className="surface-card p-6">
      <h3 className="text-lg font-bold text-slate-900">Sem permissão</h3>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-screen relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#dbe7ff] via-[#cfd9e8] to-[#c4d2e6] text-slate-700">
        <div className="pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full bg-[#2c348c]/20 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-[#e42424]/20 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute bottom-[-90px] left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/35 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center gap-5 rounded-3xl border border-white/50 bg-white/55 px-10 py-9 shadow-[0_24px_50px_rgba(44,52,140,0.20)] backdrop-blur-md">
          <div className="relative h-14 w-14 [perspective:800px]">
            <div className="absolute inset-0 rounded-xl border border-[#2c348c]/40 bg-gradient-to-br from-[#2c348c] to-[#06183e] shadow-[0_8px_20px_rgba(44,52,140,0.35)] animate-spin" />
            <div className="absolute inset-2 rounded-lg border border-white/60 bg-white/20 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-black tracking-wide text-[#132b66]">Validando sessão</p>
            <p className="mt-1 text-[11px] text-slate-600">Preparando ambiente seguro do CRM...</p>
          </div>
          <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/70">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#2c348c] via-[#4f5cb6] to-[#e42424]" />
          </div>
        </div>
      </div>
    );
  }

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
      case Page.OCORRENCIAS:
        if (!hasPermission('tab.operacional.ocorrencias.view')) {
          return noAccess('Seu perfil não possui acesso à tela de Ocorrências.');
        }
        return (
          <OcorrenciasHub
            data={ocorrencias.data}
            onNoteClick={setSelectedCte}
            serverPagination={{
              page: ocorrencias.page,
              limit: ocorrencias.limit,
              total: ocorrencias.total,
              onPageChange: setOcorrenciasPage,
              onLimitChange: setOcorrenciasLimit,
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setThemeDark((v) => !v)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2c348c]/20 bg-white/80 text-slate-700 hover:text-[#2c348c]"
              title={themeDark ? "Tema claro" : "Tema escuro"}
            >
              {themeDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="relative z-50">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2c348c]/20 bg-white/80 text-slate-700 hover:text-[#2c348c]"
                title="Notificações operacionais"
              >
                <Bell size={16} />
                {notificationsUnread > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[#e42424] px-1 text-[10px] font-bold text-white">
                    {notificationsUnread > 9 ? "9+" : notificationsUnread}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-xs font-bold text-slate-800">Atribuições operacionais</span>
                    <button
                      type="button"
                      className="text-[11px] text-[#2c348c] hover:underline"
                      onClick={async () => {
                        const maxId = Math.max(0, ...notifications.map((n) => Number(n.id || 0)));
                        if (maxId > 0) await authClient.ackOperationalNotifications(maxId).catch(() => null);
                        setNotificationsUnread(0);
                        setNotificationsOpen(false);
                      }}
                    >
                      Marcar lidas
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-slate-500">Sem novidades.</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-700">
                          <div className="font-semibold">
                            {n.event === "CTE_ASSIGNMENT_UPSERT" ? "Atribuição criada/atualizada" : "Atribuição devolvida"}
                          </div>
                          <div>CTE {n.cte || "-"} / Série {n.serie || "-"}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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