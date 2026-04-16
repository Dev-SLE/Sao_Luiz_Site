'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider as GlobalDataProvider } from './context/DataContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import NoteModal from './components/NoteModal';
import AlertOverlay from './components/AlertOverlay';
import { Page, CteData } from './types';
import { pageToWorkspacePath, pathToPage } from '@/lib/workspace-routes';
import { WorkspaceModuleRouter } from '@/modules/WorkspaceModuleRouter';
import { WorkspaceShellProvider } from '@/context/WorkspaceShellContext';

export type WorkspaceNavigationClient = {
  pathname: string;
  push: (href: string) => void;
};

function minimalCteFromQuery(cte: string, serie: string): CteData {
  const s = serie || '0';
  return {
    CTE: cte,
    SERIE: s,
    CODIGO: '',
    DATA_EMISSAO: '',
    PRAZO_BAIXA_DIAS: '',
    DATA_LIMITE_BAIXA: '',
    STATUS: 'EM BUSCA',
    COLETA: '',
    ENTREGA: '',
    VALOR_CTE: '',
    TX_ENTREGA: '',
    VOLUMES: '',
    PESO: '',
    FRETE_PAGO: '',
    DESTINATARIO: '',
    JUSTIFICATIVA: '',
  };
}

/**
 * Área de trabalho sem providers — use dentro de `AppProviders` no layout Next. Passe `workspaceClient` a partir de
 * `usePathname` + `useRouter`. O despacho visual por módulo (`/app/...`) vive em `WorkspaceModuleRouter`.
 */
export const WorkspaceApp: React.FC<{ workspaceClient?: WorkspaceNavigationClient | null }> = ({
  workspaceClient,
}) => {
  const pathname = (workspaceClient?.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/'))
    .replace(/\/+$/, '') || '/';
  const urlMode = pathname.startsWith('/app');

  const { user, logout, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
      return pathToPage(window.location.pathname);
    }
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sle_current_page') : null;
    const values = Object.values(Page) as string[];
    if (saved && values.includes(saved)) return saved as Page;
    return Page.DASHBOARD;
  });

  const navigateToPage = useCallback(
    (p: Page) => {
      setCurrentPage(p);
      if (urlMode && workspaceClient) {
        const target = pageToWorkspacePath(p);
        if (target !== pathname) workspaceClient.push(target);
      } else if (typeof window !== 'undefined') {
        window.localStorage.setItem('sle_current_page', p);
      }
    },
    [pathname, urlMode, workspaceClient],
  );

  const navigateHref = useCallback(
    (href: string) => {
      const target = href.replace(/\/+$/, '') || '/';
      if (urlMode && workspaceClient) {
        if (target !== pathname) workspaceClient.push(target);
        return;
      }
      const page = pathToPage(target);
      setCurrentPage(page);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('sle_current_page', page);
      }
    },
    [pathname, urlMode, workspaceClient],
  );

  useEffect(() => {
    if (!urlMode || !workspaceClient) return;
    const p = pathToPage(workspaceClient.pathname.replace(/\/+$/, '') || '/');
    setCurrentPage((prev) => (prev !== p ? p : prev));
  }, [urlMode, workspaceClient]);
  const [selectedCte, setSelectedCte] = useState<CteData | null>(null);
  const openedCteFromUrlRef = useRef<string | null>(null);
  const [selectedCrmLeadId, setSelectedCrmLeadId] = useState<string | null>(null);
  const [selectedTrackingCte, setSelectedTrackingCte] = useState<string | null>(null);
  const [selectedTrackingSerie, setSelectedTrackingSerie] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeDark, setThemeDark] = useState(false);
  const isCrmModule = pathname.startsWith('/app/crm');

  useEffect(() => {
    if (!selectedCte) openedCteFromUrlRef.current = null;
  }, [selectedCte]);

  useEffect(() => {
    if (!user || !urlMode || typeof window === 'undefined' || !workspaceClient) return;
    const sp = new URLSearchParams(window.location.search);
    const cte = sp.get('cte')?.trim();
    const serie = sp.get('serie')?.trim() || '0';
    if (!cte) return;
    const sig = `${cte}|${serie}`;
    if (openedCteFromUrlRef.current === sig) return;
    openedCteFromUrlRef.current = sig;
    setSelectedCte(minimalCteFromQuery(cte, serie));
    const base = (workspaceClient.pathname || '/app').split('?')[0];
    if (!base.includes('/em-busca') && !base.includes('/pendencias')) {
      workspaceClient.push('/app/operacional/em-busca');
    }
    if (window.location.search) {
      window.history.replaceState({}, '', base);
    }
  }, [user, urlMode, workspaceClient, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || urlMode) return;
    window.localStorage.setItem('sle_current_page', currentPage);
  }, [currentPage, urlMode]);

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

  if (loading) {
    return (
      <div className="loading-screen relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100 via-[#f5f7fa] to-slate-200 text-slate-700">
        <div className="pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full bg-sl-navy/15 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-sl-red/15 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute bottom-[-90px] left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/40 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center gap-5 rounded-3xl border border-border bg-card/80 px-10 py-9 shadow-[0_24px_50px_rgba(10,22,40,0.12)] backdrop-blur-md">
          <div className="relative h-14 w-14 [perspective:800px]">
            <div className="absolute inset-0 rounded-xl border border-sl-navy/30 bg-gradient-to-br from-sl-navy to-sl-navy-light shadow-[0_8px_20px_rgba(10,22,40,0.25)] animate-spin" />
            <div className="absolute inset-2 rounded-lg border border-white/50 bg-white/15 animate-pulse" />
          </div>
          <div className="text-center font-body">
            <p className="text-sm font-black tracking-wide text-sl-navy">Validando sessão</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Preparando ambiente seguro...</p>
          </div>
          <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-sl-navy via-sl-navy-light to-sl-red" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-typography flex h-screen overflow-hidden bg-background text-foreground">
      <AlertOverlay onOpenCte={setSelectedCte} />
      <Sidebar
        pathname={pathname}
        onNavigateHref={navigateHref}
        currentPage={currentPage}
        setPage={navigateToPage}
        logout={logout}
      />

      <WorkspaceShellProvider
        value={{
          user: { username: user.username },
          logout,
          navigateToPage,
          themeDark,
          setThemeDark,
          profileOpen,
          setProfileOpen,
        }}
      >
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className={
              isCrmModule
                ? 'sle-app-main flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scroll-smooth p-3 pt-2 md:p-4 md:pt-3'
                : 'sle-app-main flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth p-3 pt-2 md:p-5 md:pt-3'
            }
          >
            <div
              className={
                isCrmModule
                  ? 'mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col'
                  : 'mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col'
              }
            >
              <WorkspaceModuleRouter
                pathname={pathname}
                onNoteClick={setSelectedCte}
                navigateToPage={navigateToPage}
                tracking={{ cte: selectedTrackingCte, serie: selectedTrackingSerie }}
                selectedCrmLeadId={selectedCrmLeadId}
                setSelectedCrmLeadId={setSelectedCrmLeadId}
                onOpenTracking={(cte, serie) => {
                  setSelectedTrackingCte(cte);
                  setSelectedTrackingSerie(serie ?? null);
                  navigateToPage(Page.RASTREIO_OPERACIONAL);
                }}
              />
            </div>
          </div>
        </main>
      </WorkspaceShellProvider>

      {selectedCte && (
        <NoteModal cte={selectedCte} onClose={() => setSelectedCte(null)} />
      )}
    </div>
  );
};

/** Entrada legada (Vite / bootstrap) com providers embutidos. */
const App: React.FC = () => {
  return (
    <AuthProvider>
      <GlobalDataProvider>
        <WorkspaceApp />
      </GlobalDataProvider>
    </AuthProvider>
  );
};

export default App;