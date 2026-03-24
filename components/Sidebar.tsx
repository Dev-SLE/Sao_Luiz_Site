import React, { useState } from 'react';
import {
  Home,
  ClipboardList,
  AlertTriangle,
  Search,
  Settings,
  Menu,
  X,
  Tag,
  Archive,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  MessagesSquare,
  FileSpreadsheet,
  MapPin,
  LineChart,
} from 'lucide-react';
import { Page } from '../types';
import clsx from 'clsx';
import { useData } from '../context/DataContext';

interface Props {
  currentPage: Page;
  setPage: (p: Page) => void;
  logout: () => void;
}

const Sidebar: React.FC<Props> = ({ currentPage, setPage }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    operacional: true,
    crm: true,
    auditoria: true,
  });
  const { counts, hasPermission } = useData();

  const sections = [
    {
      id: 'operacional',
      label: 'Operacional',
      items: [
        hasPermission('VIEW_DASHBOARD') && {
          id: Page.DASHBOARD,
          label: 'Visão Geral',
          icon: Home,
          count: 0,
        },
        hasPermission('VIEW_PENDENCIAS') && {
          id: Page.PENDENCIAS,
          label: 'Pendências',
          icon: ClipboardList,
          count: counts.pendencias,
        },
        hasPermission('VIEW_CRITICOS') && {
          id: Page.CRITICOS,
          label: 'Críticos',
          icon: AlertTriangle,
          count: counts.criticos,
        },
        hasPermission('VIEW_EM_BUSCA') && {
          id: Page.EM_BUSCA,
          label: 'Em Busca',
          icon: Search,
          count: counts.emBusca,
        },
        hasPermission('VIEW_TAD') && {
          id: Page.TAD,
          label: 'Processos TAD',
          icon: Tag,
          count: counts.tad,
        },
        hasPermission('VIEW_RASTREIO_OPERACIONAL') && {
          id: Page.RASTREIO_OPERACIONAL,
          label: 'Rastreio Operacional',
          icon: MapPin,
          count: counts.emBusca,
        },
        hasPermission('VIEW_CONCLUIDOS') && {
          id: Page.CONCLUIDOS,
          label: 'Concluídos / Resolvidos',
          icon: Archive,
          count: counts.concluidos,
        },
      ].filter(Boolean) as any[],
    },
    {
      id: 'crm',
      label: 'Atendimento CRM',
      items: [
        hasPermission('VIEW_CRM_DASHBOARD') && {
          id: Page.CRM_DASHBOARD,
          label: 'Dashboard CRM',
          icon: Home,
          count: 0,
        },
        hasPermission('VIEW_CRM_FUNIL') && {
          id: Page.CRM_FUNIL,
          label: 'Funil de Rastreio',
          icon: Columns3,
          count: 0,
        },
        hasPermission('VIEW_CRM_CHAT') && {
          id: Page.CRM_CHAT,
          label: 'Chat IA',
          icon: MessagesSquare,
          count: 0,
        },
      ].filter(Boolean) as any[],
    },
    {
      id: 'auditoria',
      label: 'Comercial',
      items: [
        (hasPermission('VIEW_RELATORIOS') || hasPermission('MANAGE_SETTINGS')) && {
          id: Page.COMERCIAL_AUDITORIA,
          label: 'Comercial - Metas',
          icon: LineChart,
          count: 0,
        },
        (hasPermission('VIEW_RELATORIOS') || hasPermission('MANAGE_SETTINGS')) && {
          id: Page.COMERCIAL_ROBO_SUPREMO,
          label: 'Comercial - Robô Supremo',
          icon: Settings,
          count: 0,
        },
      ].filter(Boolean) as any[],
    },
  ];

  const adminSection = hasPermission('MANAGE_SETTINGS')
    ? {
        id: 'admin',
        label: 'Administração',
        items: [
          { id: Page.CONFIGURACOES, label: 'Configurações', icon: Settings, count: 0 },
          { id: Page.RELATORIOS, label: 'Relatórios', icon: FileSpreadsheet, count: 0 },
          hasPermission('MANAGE_SOFIA') && {
            id: Page.SOFIA_CONFIG,
            label: 'Configurações da Sofia',
            icon: MessagesSquare,
            count: 0,
          },
        ].filter(Boolean) as any[],
      }
    : null;

  const allSections = adminSection ? [...sections, adminSection] : sections;
  const compactItems = allSections.flatMap((s) => s.items);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatCount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace('.0', '')}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}k`;
    return String(value);
  };

  const renderSection = (sectionId: string, isMobile: boolean, isPinned: boolean) => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section || section.items.length === 0) return null;

    const isOpen = openSections[section.id] ?? true;

    return (
      <div
        key={section.id}
        className={clsx(
          'mt-3 rounded-xl border border-slate-200/90 bg-white/95 p-2 shadow-sm',
          !isMobile && !isPinned && 'mt-2 group-hover:mt-3',
        )}
      >
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={clsx(
            'flex w-full items-center justify-between rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2c348c]',
            !isMobile &&
              (isPinned
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none h-0 -translate-x-4 overflow-hidden py-0 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:h-auto group-hover:translate-x-0 group-hover:py-1 group-hover:opacity-100'),
          )}
        >
          <span>{section.label}</span>
          <span className="ml-2 flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-[#2c348c]">
            {isOpen ? '−' : '+'}
          </span>
        </button>
        {isOpen && (
          <nav
            className={clsx(
              'mt-2 space-y-1',
              !isMobile && !isPinned && 'mt-0 space-y-0 group-hover:mt-2 group-hover:space-y-1',
            )}
          >
            {section.items.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPage(item.id);
                    setMobileOpen(false);
                  }}
                  className={clsx(
                    'relative flex w-full items-center rounded-xl py-2.5 text-sm font-semibold transition-all duration-200',
                    isMobile
                      ? 'px-3'
                      : isPinned
                        ? 'px-3'
                        : 'justify-center px-2 group-hover:justify-start group-hover:px-3',
                    'sle-nav-tab',
                    active && 'sle-nav-tab-active',
                  )}
                >
                  {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#e42424]" />}
                  <div
                    className={clsx(
                      'relative flex w-full items-center gap-3',
                      !isMobile && !isPinned && 'justify-center group-hover:justify-start',
                    )}
                  >
                    <item.icon size={20} className="shrink-0 text-white" />
                    <span
                      className={clsx(
                        'whitespace-nowrap text-xs font-semibold tracking-tight text-white',
                        !isMobile &&
                          (isPinned
                            ? 'translate-x-0 opacity-100'
                            : '-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100'),
                      )}
                    >
                      {item.label}
                    </span>
                    {item.count > 0 && (
                      <span
                        className={clsx(
                          'ml-auto min-w-[2.6rem] shrink-0 rounded-full border px-2.5 py-0.5 text-center text-[10px] font-black leading-none tabular-nums',
                            active
                            ? 'border-white/30 bg-[#e42424] text-white shadow-sm'
                            : 'border-white/25 bg-white/15 text-white',
                          !isMobile &&
                            (isPinned
                              ? 'opacity-100'
                              : 'opacity-0 transition-opacity duration-300 group-hover:opacity-100'),
                        )}
                      >
                        {formatCount(item.count)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    );
  };

  const desktopSidebar = (
    <div className="hidden h-screen md:flex">
      <div className="group relative flex h-full overflow-hidden">
        <aside
          className={clsx(
            'relative z-10 flex h-full overflow-x-hidden sle-sidebar-panel transition-[width] duration-300 ease-out',
            pinned ? 'w-64' : 'w-20 group-hover:w-64',
          )}
        >
          <div className="flex h-full w-full flex-col py-4">
            <div className="mb-4 px-3">
              <div
                className={clsx(
                  'flex w-full items-center gap-3',
                  pinned ? 'justify-start' : 'justify-center group-hover:justify-start',
                )}
              >
                <div className="sle-logo-bar flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                  <img
                    src="/logo_transparente.png"
                    alt="São Luiz Express"
                    className="h-9 w-9 object-contain"
                    draggable={false}
                  />
                </div>

                <div className={clsx('min-w-0', pinned ? 'block' : 'hidden group-hover:block')}>
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2c348c]">
                    São Luiz Express
                  </p>
                  <p className="truncate text-sm font-bold text-[#06183e]">Plataforma</p>
                </div>
              </div>
            </div>

            <div
              className={clsx(
                'flex-1 overflow-x-hidden overflow-y-auto',
                !pinned &&
                  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0',
              )}
            >
              {!pinned && (
                <div className="block px-2 group-hover:hidden">
                  <nav className="space-y-1">
                    {compactItems.map((item) => {
                      const active = currentPage === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={item.label}
                          onClick={() => setPage(item.id)}
                          className={clsx(
                            'relative flex w-full items-center justify-center rounded-xl py-3 text-sm transition-all duration-200',
                            'sle-nav-tab',
                            active && 'sle-nav-tab-active',
                          )}
                        >
                          <item.icon size={20} className="shrink-0 text-white" />
                        </button>
                      );
                    })}
                  </nav>
                </div>
              )}

              <div className={clsx(pinned ? 'block' : 'hidden group-hover:block')}>
                {renderSection('operacional', false, pinned)}
                {renderSection('crm', false, pinned)}
                {renderSection('auditoria', false, pinned)}
                {adminSection && renderSection('admin', false, pinned)}
              </div>
            </div>

            <div className="mt-auto px-3 pb-3 pt-2">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinned((v) => !v)}
                  className="sle-pin-btn inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all"
                  title={pinned ? 'Recolher menu' : 'Expandir menu'}
                >
                  {pinned ? <ChevronsLeft size={18} strokeWidth={2.5} /> : <ChevronsRight size={18} strokeWidth={2.5} />}
                </button>
              </div>
              <p
                className={clsx(
                  'mt-2 text-[9px] uppercase tracking-[0.2em] text-[#2c348c]/70',
                  pinned ? 'opacity-100' : 'opacity-100 transition-opacity duration-300 group-hover:opacity-100',
                )}
              >
                Gestão inteligente
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  const mobileSidebar = (
    <>
      <div className="fixed left-0 top-0 z-50 p-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="sle-pin-btn rounded-xl p-2.5 shadow-md"
        >
          <Menu size={22} />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex h-full w-72 flex-col sle-sidebar-panel shadow-2xl shadow-slate-900/15">
            <div className="flex items-center justify-between border-b border-slate-200/90 bg-white/80 px-3 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="sle-logo-bar flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <img
                    src="/logo_transparente.png"
                    alt=""
                    className="h-9 w-9 object-contain"
                    draggable={false}
                  />
                </div>
                <div className="min-w-0 flex flex-col">
                  <span className="truncate text-xs font-bold text-[#06183e]">São Luiz Express</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#2c348c]/80">Plataforma</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-[#2c348c] hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-1 py-2">
              {renderSection('operacional', true, true)}
              {renderSection('crm', true, true)}
              {renderSection('auditoria', true, true)}
              {adminSection && renderSection('admin', true, true)}
            </div>
          </div>
          <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );

  return (
    <>
      {mobileSidebar}
      {desktopSidebar}
    </>
  );
};

export default Sidebar;
