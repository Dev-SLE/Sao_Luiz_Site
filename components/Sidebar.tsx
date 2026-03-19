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
} from 'lucide-react';
import { Page } from '../types';
import clsx from 'clsx';
import { useData } from '../context/DataContext';

interface Props {
  currentPage: Page;
  setPage: (p: Page) => void;
  logout: () => void; // Mantido por compatibilidade, agora usado apenas no header
}

const Sidebar: React.FC<Props> = ({ currentPage, setPage, logout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
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
          count:
            counts.pendencias +
            counts.criticos +
            counts.emBusca +
            counts.tad +
            counts.concluidos,
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
      label: 'Auditoria',
      items: [
        hasPermission('VIEW_CONCLUIDOS') && {
          id: Page.CONCLUIDOS,
          label: 'Concluídos / Resolvidos',
          icon: Archive,
          count: counts.concluidos,
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

  const renderSection = (sectionId: string, isMobile: boolean, isPinned: boolean) => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section || section.items.length === 0) return null;

    const isOpen = openSections[section.id] ?? true;

    return (
      <div
        key={section.id}
        className={clsx(
          'mt-4',
          !isMobile && !isPinned && 'mt-2 group-hover:mt-4'
        )}
      >
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={clsx(
            'flex w-full items-center justify-between px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4B4FA8]',
            !isMobile &&
              (isPinned
                ? 'opacity-100 translate-x-0'
                : 'h-0 py-0 opacity-0 -translate-x-4 overflow-hidden pointer-events-none group-hover:h-auto group-hover:py-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300')
          )}
        >
          <span>{section.label}</span>
          <span className="ml-2 text-[9px] text-[#6E71DA]">
            {isOpen ? '−' : '+'}
          </span>
        </button>
        {isOpen && (
          <nav
            className={clsx(
              'mt-2 space-y-1',
              !isMobile && !isPinned && 'mt-0 space-y-0 group-hover:mt-2 group-hover:space-y-1'
            )}
          >
            {section.items.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setPage(item.id);
                    setMobileOpen(false);
                  }}
                  className={clsx(
                    'relative w-full flex items-center rounded-xl py-3 text-sm text-gray-200 transition-all duration-300',
                    isMobile
                      ? 'px-3'
                      : isPinned
                        ? 'px-3'
                        : 'px-2 justify-center group-hover:px-3 group-hover:justify-start',
                    'hover:bg-[#131437]',
                    active && 'bg-[#131437] text-white'
                  )}
                >
                  {active && (
                    <div className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-[#FF1744] shadow-[0_0_12px_rgba(255,23,68,0.8)]" />
                  )}
                  <div
                    className={clsx(
                      'relative flex items-center gap-3 w-full',
                      !isMobile && !isPinned && 'justify-center group-hover:justify-start'
                    )}
                  >
                    <item.icon
                      size={20}
                      className={clsx(
                        'shrink-0 text-[#6E71DA]',
                        active && 'text-[#FF4D4D]'
                      )}
                    />
                    <span
                      className={clsx(
                        'text-xs font-medium whitespace-nowrap',
                        !isMobile &&
                          (isPinned
                            ? 'opacity-100 translate-x-0'
                            : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300')
                      )}
                    >
                      {item.label}
                    </span>
                    {item.count > 0 && (
                      <span
                        className={clsx(
                          'ml-auto text-[10px] font-black px-2 py-0.5 rounded-full',
                          active
                            ? 'bg-[#FF1744] text-white shadow-[0_0_8px_rgba(255,23,68,0.7)]'
                            : 'bg-[#1A1B62] text-[#C7CBFF]',
                          !isMobile &&
                            (isPinned
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 transition-opacity duration-300')
                        )}
                      >
                        {item.count}
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
    <div className="hidden md:flex h-screen">
      <div className="group flex h-full bg-[#050511]">
        <aside
          className={clsx(
            'relative flex h-full bg-[#080816]/95 border-r border-[#151745] shadow-[12px_0_35px_rgba(0,0,0,0.65)] transition-[width] duration-300 ease-out overflow-x-hidden',
            pinned ? 'w-64' : 'w-20 group-hover:w-64'
          )}
        >
          <div className="flex flex-col h-full w-full py-5">
            <div className="px-3 mb-6">
              <div
                className={clsx(
                  'flex items-center w-full',
                  pinned ? 'justify-start' : 'justify-center group-hover:justify-start'
                )}
              >
                {/* Collapsed: only compact logo */}
                <div
                  className={clsx(
                    'relative h-10 w-10 items-center justify-center rounded-xl bg-[#EC1B23]/10 border border-[#EC1B23]/45 shadow-[0_0_18px_rgba(236,27,35,0.65)] overflow-hidden',
                    pinned ? 'hidden' : 'flex group-hover:hidden'
                  )}
                >
                  <img
                    src="/logo_transparente.png"
                    alt="São Luiz Express"
                    className="h-8 w-8 object-contain"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-white/5" />
                </div>

                {/* Expanded (hover or pinned): only big logo */}
                <div
                  className={clsx(
                    'min-w-0 flex-1',
                    pinned ? 'block' : 'hidden group-hover:block'
                  )}
                >
                  <div className="rounded-xl bg-gradient-to-br from-[#0F103A] via-[#080816] to-[#131437] border border-[#EC1B23]/35 shadow-[0_0_18px_rgba(236,27,35,0.45)] px-1.5 py-1.5 flex items-center justify-center overflow-visible">
                    <img
                      src="/logo_transparente.png"
                      alt="São Luiz Express"
                      className="h-14 w-full object-contain scale-[2.35] translate-y-[6.5px]"
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={clsx(
                'flex-1 overflow-x-hidden overflow-y-auto',
                !pinned &&
                  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0'
              )}
            >
              {/* Compact mode (collapsed): icons only, no section headers/spacing */}
              {!pinned && (
                <div className="block group-hover:hidden px-2">
                  <nav className="space-y-1">
                    {compactItems.map((item) => {
                      const active = currentPage === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setPage(item.id)}
                          title={item.label}
                          className={clsx(
                            'relative w-full flex items-center justify-center rounded-xl py-3 text-sm text-gray-200 transition-all duration-300',
                            'hover:bg-[#131437]',
                            active && 'bg-[#131437] text-white'
                          )}
                        >
                          {active && (
                            <div className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-[#FF1744] shadow-[0_0_12px_rgba(255,23,68,0.8)]" />
                          )}
                          <item.icon
                            size={20}
                            className={clsx(
                              'shrink-0 text-[#6E71DA]',
                              active && 'text-[#FF4D4D]'
                            )}
                          />
                        </button>
                      );
                    })}
                  </nav>
                </div>
              )}

              {/* Expanded mode (hover or pinned): full menu */}
              <div className={clsx(pinned ? 'block' : 'hidden group-hover:block')}>
                {renderSection('operacional', false, pinned)}
                {renderSection('crm', false, pinned)}
                {renderSection('auditoria', false, pinned)}
                {adminSection && renderSection('admin', false, pinned)}
              </div>
            </div>

            <div className="mt-4 px-3 pb-2">
              <div className="flex items-center justify-between">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2F3278] to-transparent" />
                <button
                  type="button"
                  onClick={() => setPinned((v) => !v)}
                  className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#2F3278] bg-[#050511] text-[#6E71DA] hover:border-[#EC1B23] hover:text-[#EC1B23] shadow-[0_0_10px_rgba(0,0,0,0.6)] transition-all"
                  title={pinned ? 'Desafixar menu' : 'Fixar menu'}
                >
                  {pinned ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
                </button>
              </div>
              <p
                className={clsx(
                  'mt-3 text-[9px] text-[#6B6FBE] uppercase tracking-[0.25em]',
                  pinned
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                )}
              >
                Gestão Inteligente
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  const mobileSidebar = (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-0 left-0 p-4 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="bg-[#080816] text-white p-2 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.6)] border border-[#1A1B62]"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 h-full bg-[#050511] border-r border-[#151745] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#151745]">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EC1B23]/10 border border-[#EC1B23]/45 shadow-[0_0_18px_rgba(236,27,35,0.6)] overflow-hidden">
                  <img
                    src="/logo_transparente.png"
                    alt="São Luiz Express"
                    className="h-7 w-7 object-contain"
                    draggable={false}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-100">São Luiz Express</span>
                  <span className="text-[10px] text-[#6E71DA] uppercase tracking-[0.2em]">Pendências</span>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-full bg-white/5 text-gray-300 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-1 py-2">
              {renderSection('operacional', true, true)}
              {renderSection('crm', true, true)}
              {renderSection('auditoria', true, true)}
              {adminSection && renderSection('admin', true, true)}
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
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