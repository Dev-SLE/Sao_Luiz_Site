import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Menu, X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Page } from '../types';
import clsx from 'clsx';
import { useData } from '../context/DataContext';
import {
  buildWorkspaceNavSections,
  workspaceNavChildIsActive,
  workspaceNavGroupId,
  type WorkspaceNavItem,
} from '@/lib/navigation-manifest';

function normalizeWorkspacePath(p: string) {
  return p.replace(/\/+$/, '') || '/';
}

const SIDEBAR_NAV_SCROLL_KEY = 'sle_sidebar_nav_scroll_v1';
const SIDEBAR_MANUAL_EXPANDED_KEY = 'sle_sidebar_manual_expanded_v1';
const SIDEBAR_ROUTE_COLLAPSED_KEY = 'sle_sidebar_route_collapsed_v1';

function readManualExpanded(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SIDEBAR_MANUAL_EXPANDED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function readRouteCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SIDEBAR_ROUTE_COLLAPSED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function navItemIsActive(pathname: string, item: WorkspaceNavItem): boolean {
  const p = normalizeWorkspacePath(pathname);
  const prefix = normalizeWorkspacePath(item.matchPrefix ?? item.href);
  return p === prefix || p.startsWith(`${prefix}/`);
}

interface Props {
  pathname: string;
  onNavigateHref: (href: string) => void;
  currentPage: Page;
  setPage: (p: Page) => void;
  logout: () => void;
}

const Sidebar: React.FC<Props> = ({ pathname, onNavigateHref, currentPage, setPage }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = window.localStorage.getItem('sle_sidebar_pinned');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {
      /* ignore */
    }
    return true;
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  /** Acordeões abertos manualmente fora da rota ativa (rota força aberto via `routeOpenKeys`). */
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>(readManualExpanded);
  /** Na rota ativa, o utilizador pode recolher o grupo (seta); `true` = recolhido manualmente. */
  const [routeCollapsed, setRouteCollapsed] = useState<Record<string, boolean>>(readRouteCollapsed);
  const desktopNavScrollRef = useRef<HTMLDivElement>(null);
  const mobileNavScrollRef = useRef<HTMLDivElement>(null);
  const scrollSaveRaf = useRef<number | null>(null);
  const { counts, hasPermission } = useData();

  const persistNavScrollFrom = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    try {
      sessionStorage.setItem(SIDEBAR_NAV_SCROLL_KEY, String(el.scrollTop));
    } catch {
      /* ignore */
    }
  }, []);

  const schedulePersistNavScroll = useCallback(
    (el: HTMLDivElement) => {
      if (scrollSaveRaf.current != null) cancelAnimationFrame(scrollSaveRaf.current);
      scrollSaveRaf.current = window.requestAnimationFrame(() => {
        scrollSaveRaf.current = null;
        persistNavScrollFrom(el);
      });
    },
    [persistNavScrollFrom],
  );

  useLayoutEffect(() => {
    return () => {
      persistNavScrollFrom(desktopNavScrollRef.current);
      if (mobileOpen) persistNavScrollFrom(mobileNavScrollRef.current);
    };
  }, [pathname, mobileOpen, persistNavScrollFrom]);

  const allSections = useMemo(
    () => buildWorkspaceNavSections({ hasPermission, counts }),
    [hasPermission, counts],
  );
  const compactItems = allSections.flatMap((s) => s.items);

  const routeOpenKeys = useMemo(() => {
    const keys = new Set<string>();
    const p = normalizeWorkspacePath(pathname);
    for (const section of allSections) {
      for (const item of section.items) {
        if (!item.children?.length) continue;
        const key = workspaceNavGroupId(section.id, item);
        const prefix = normalizeWorkspacePath(item.matchPrefix ?? item.href);
        if (p === prefix || p.startsWith(`${prefix}/`)) {
          keys.add(key);
        }
      }
    }
    return keys;
  }, [pathname, allSections]);

  const isNavGroupExpanded = useCallback(
    (gKey: string) => {
      if (routeOpenKeys.has(gKey)) {
        return !routeCollapsed[gKey];
      }
      return manualExpanded[gKey] ?? false;
    },
    [routeOpenKeys, manualExpanded, routeCollapsed],
  );

  useEffect(() => {
    setRouteCollapsed((prev) => {
      const next = { ...prev };
      let dirty = false;
      for (const k of Object.keys(next)) {
        if (!routeOpenKeys.has(k)) {
          delete next[k];
          dirty = true;
        }
      }
      return dirty ? next : prev;
    });
  }, [routeOpenKeys]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIDEBAR_MANUAL_EXPANDED_KEY, JSON.stringify(manualExpanded));
    } catch {
      /* ignore */
    }
  }, [manualExpanded]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIDEBAR_ROUTE_COLLAPSED_KEY, JSON.stringify(routeCollapsed));
    } catch {
      /* ignore */
    }
  }, [routeCollapsed]);

  useLayoutEffect(() => {
    const apply = (el: HTMLDivElement | null) => {
      if (!el) return;
      try {
        const raw = sessionStorage.getItem(SIDEBAR_NAV_SCROLL_KEY);
        if (raw == null) return;
        const y = parseInt(raw, 10);
        if (!Number.isNaN(y)) el.scrollTop = y;
      } catch {
        /* ignore */
      }
    };
    const run = () => {
      apply(desktopNavScrollRef.current);
      if (mobileOpen) apply(mobileNavScrollRef.current);
    };
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, [pathname, mobileOpen, pinned, routeOpenKeys, routeCollapsed]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const toggleNavGroup = (gKey: string) => {
    if (routeOpenKeys.has(gKey)) {
      setRouteCollapsed((prev) => {
        const next = { ...prev };
        if (next[gKey]) {
          delete next[gKey];
        } else {
          next[gKey] = true;
        }
        return next;
      });
      return;
    }
    setManualExpanded((prev) => ({ ...prev, [gKey]: !(prev[gKey] ?? false) }));
  };

  const formatCount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace('.0', '')}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}k`;
    return String(value);
  };

  const renderNavItemRow = (
    item: WorkspaceNavItem,
    sectionId: string,
    isMobile: boolean,
    isPinned: boolean,
    isLightPanel: boolean,
  ) => {
    const L = isLightPanel;
    const active = item.href ? navItemIsActive(pathname, item) : currentPage === item.id;
    const childActive =
      item.children?.some((c) => c.href && workspaceNavChildIsActive(pathname, c.href)) ?? false;
    const branchActive = active || childActive;

    if (item.children?.length) {
      const gKey = workspaceNavGroupId(sectionId, item);
      const expanded = isNavGroupExpanded(gKey);

      return (
        <div key={`${item.id}-${item.href}-tree`} className="space-y-0.5">
          <div
            className={clsx(
              'flex w-full min-w-0 items-stretch overflow-hidden rounded-xl shadow-sm transition-all duration-200',
              'sle-nav-tab',
              branchActive && 'sle-nav-tab-active',
              !isMobile && !isPinned && 'justify-center group-hover:justify-start',
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (item.href) onNavigateHref(item.href);
                else setPage(item.id);
                setMobileOpen(false);
              }}
              className={clsx(
                'relative flex min-w-0 flex-1 items-center rounded-none border-0 bg-transparent py-2.5 text-left text-sm font-semibold text-white shadow-none ring-0 transition-colors duration-200 hover:bg-white/[0.06]',
                isMobile ? 'px-2' : isPinned ? 'px-2' : 'justify-center px-1 group-hover:justify-start group-hover:px-2',
              )}
            >
              {branchActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sl-red" />
              )}
              <div
                className={clsx(
                  'relative flex min-w-0 flex-1 items-center gap-2',
                  !isMobile && !isPinned && 'justify-center group-hover:justify-start',
                )}
              >
                <item.icon size={20} className="shrink-0 text-white" />
                <span
                  className={clsx(
                    'min-w-0 flex-1 truncate text-xs font-semibold tracking-tight text-white',
                    !isMobile &&
                      (isPinned
                        ? 'translate-x-0 opacity-100'
                        : 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[10rem] group-hover:opacity-100'),
                  )}
                >
                  {item.label}
                </span>
                {item.count > 0 && (
                  <span
                    className={clsx(
                      'min-w-[2rem] max-w-[3rem] shrink-0 truncate rounded-full border px-1.5 py-0.5 text-center text-[10px] font-black leading-none tabular-nums',
                      branchActive
                        ? 'border-white/30 bg-sl-red text-white'
                        : 'border-white/25 bg-white/15 text-white',
                      !isMobile &&
                        (isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'),
                    )}
                  >
                    {formatCount(item.count)}
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              title={expanded ? 'Recolher submenu' : 'Expandir submenu'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleNavGroup(gKey);
              }}
              className={clsx(
                'relative flex w-11 shrink-0 items-center justify-center border-l border-white/20 bg-transparent py-2.5 text-white transition-colors hover:bg-white/[0.1]',
                isMobile || isPinned ? '' : 'hidden group-hover:flex',
              )}
            >
              <span
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ring-1 ring-white/35',
                  branchActive && 'bg-white/22 ring-white/50',
                )}
              >
                <ChevronDown
                  size={16}
                  strokeWidth={2.35}
                  className={clsx(
                    'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
                    'transition-transform duration-200',
                    !expanded && '-rotate-90',
                  )}
                />
              </span>
            </button>
          </div>
          {expanded && (
            <div
              className={clsx(
                'ml-2 space-y-0.5 py-0.5 pl-2',
                L ? 'border-l border-slate-200' : 'border-l border-white/20',
                !isMobile && !isPinned && 'hidden group-hover:block',
              )}
            >
              {item.children.map((child) => {
                const cKey = child.href ?? `planned-${child.label}`;
                const cActive = workspaceNavChildIsActive(pathname, child.href);
                const isPlanned = child.status === 'planned' || !child.href;
                if (isPlanned) {
                  return (
                    <div
                      key={cKey}
                      className={clsx(
                        'flex w-full items-center justify-between gap-2 rounded-lg py-1.5 pl-2 pr-1 text-left text-[11px] font-semibold',
                        L ? 'text-slate-500' : 'text-white/55',
                      )}
                    >
                      <span className="min-w-0 truncate">{child.label}</span>
                      <span
                        className={clsx(
                          'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                          L ? 'bg-slate-200/80 text-slate-600' : 'bg-white/10 text-white/70',
                        )}
                      >
                        Em breve
                      </span>
                    </div>
                  );
                }
                return (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => {
                      if (child.href) onNavigateHref(child.href);
                      setMobileOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between gap-2 rounded-lg py-1.5 pl-2 pr-1 text-left text-[11px] font-semibold transition-colors',
                      L &&
                        (cActive
                          ? 'bg-slate-200/95 text-sl-navy shadow-sm ring-2 ring-sl-red/45 ring-offset-0'
                          : 'text-slate-800 hover:bg-slate-100'),
                      !L &&
                        (cActive
                          ? 'bg-white/32 text-white shadow-sm ring-2 ring-white/55 ring-offset-0 ring-offset-transparent'
                          : 'text-white/80 hover:bg-white/[0.14] hover:text-white'),
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{child.label}</span>
                    {child.count != null && child.count > 0 ? (
                      <span className="shrink-0 rounded-full bg-sl-red/95 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white">
                        {formatCount(child.count)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={`${item.id}-${item.href}`}
        type="button"
        onClick={() => {
          if (item.href) onNavigateHref(item.href);
          else setPage(item.id);
          setMobileOpen(false);
        }}
        className={clsx(
          'relative flex w-full items-center rounded-xl py-2.5 text-sm font-semibold transition-all duration-200',
          isMobile ? 'px-3' : isPinned ? 'px-3' : 'justify-center px-2 group-hover:justify-start group-hover:px-3',
          'sle-nav-tab',
          active && 'sle-nav-tab-active',
        )}
      >
        {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sl-red" />}
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
                active ? 'border-white/30 bg-sl-red text-white shadow-sm' : 'border-white/25 bg-white/15 text-white',
                !isMobile &&
                  (isPinned ? 'opacity-100' : 'opacity-0 transition-opacity duration-300 group-hover:opacity-100'),
              )}
            >
              {formatCount(item.count)}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderNavItems = (
    section: { id: string; items: WorkspaceNavItem[]; variant?: 'default' | 'minimal' },
    isMobile: boolean,
    isPinned: boolean,
  ) => (
    <nav
      className={clsx(
        'space-y-1',
        !isMobile && !isPinned && 'space-y-0 group-hover:space-y-1',
      )}
    >
      {section.items.map((item) =>
        renderNavItemRow(item, section.id, isMobile, isPinned, section.variant === 'minimal'),
      )}
    </nav>
  );

  const renderSection = (sectionId: string, isMobile: boolean, isPinned: boolean) => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section || section.items.length === 0) return null;

    if (section.variant === 'minimal') {
      return (
        <div
          key={section.id}
          className={clsx(
            'mt-4 border-t border-white/10 pt-3 first:mt-0 first:border-t-0 first:pt-0',
            !isMobile && !isPinned && 'mt-2 border-t-0 pt-0 first:mt-0 group-hover:mt-4 group-hover:border-t group-hover:border-white/10 group-hover:pt-3',
          )}
        >
          <p
            className={clsx(
              'mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sl-navy/75',
              !isMobile &&
                !isPinned &&
                'pointer-events-none h-0 overflow-hidden opacity-0 group-hover:pointer-events-auto group-hover:h-auto group-hover:opacity-100',
            )}
          >
            {section.label}
          </p>
          {renderNavItems(section, isMobile, isPinned)}
        </div>
      );
    }

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
            'flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-sl-navy',
            !isMobile &&
              (isPinned
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none h-0 -translate-x-4 overflow-hidden py-0 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:h-auto group-hover:translate-x-0 group-hover:py-1 group-hover:opacity-100'),
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block leading-tight">{section.label}</span>
            {section.subtitle ? (
              <span className="mt-1 block text-[9px] font-semibold normal-case leading-snug tracking-normal text-slate-500">
                {section.subtitle}
              </span>
            ) : null}
          </span>
          <span className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-sl-navy">
            {isOpen ? '−' : '+'}
          </span>
        </button>
        {isOpen && (
          <div className={clsx('mt-2', !isMobile && !isPinned && 'mt-0 group-hover:mt-2')}>
            {renderNavItems(section, isMobile, isPinned)}
          </div>
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
            pinned ? 'w-[268px]' : 'w-[88px] group-hover:w-[268px]',
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
                    src="/sle-brand-kangaroo.png"
                    alt="São Luiz Express"
                    className="h-full w-full object-cover object-center"
                    draggable={false}
                  />
                </div>

                <div className={clsx('min-w-0 font-body', pinned ? 'block' : 'hidden group-hover:block')}>
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-sl-navy">
                    São Luiz Express
                  </p>
                  <p className="truncate text-sm font-bold text-sl-navy">Workspace</p>
                </div>
              </div>
            </div>

            <div
              ref={desktopNavScrollRef}
              onScroll={(e) => schedulePersistNavScroll(e.currentTarget)}
              className={clsx(
                'flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]',
                !pinned &&
                  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0',
              )}
            >
              {!pinned && (
                <div className="block px-2 group-hover:hidden">
                  <nav className="space-y-1">
                    {compactItems.map((item) => {
                      const active = item.href ? navItemIsActive(pathname, item) : currentPage === item.id;
                      const childA =
                        item.children?.some((c) => c.href && workspaceNavChildIsActive(pathname, c.href)) ?? false;
                      return (
                        <button
                          key={`${item.id}-${item.href}`}
                          type="button"
                          title={item.label}
                          onClick={() => (item.href ? onNavigateHref(item.href) : setPage(item.id))}
                          className={clsx(
                            'relative flex w-full items-center justify-center rounded-xl py-3 text-sm transition-all duration-200',
                            'sle-nav-tab',
                            (active || childA) && 'sle-nav-tab-active',
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
                {allSections.map((s) => renderSection(s.id, false, pinned))}
              </div>
            </div>

            <div className="mt-auto px-3 pb-3 pt-2">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinned((v) => {
                      const next = !v;
                      try {
                        window.localStorage.setItem('sle_sidebar_pinned', next ? '1' : '0');
                      } catch {
                        /* ignore */
                      }
                      return next;
                    });
                  }}
                  className="sle-pin-btn inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all"
                  title={pinned ? 'Recolher menu' : 'Expandir menu'}
                >
                  {pinned ? <ChevronsLeft size={18} strokeWidth={2.5} /> : <ChevronsRight size={18} strokeWidth={2.5} />}
                </button>
              </div>
              <p
                className={clsx(
                  'mt-2 text-[9px] uppercase tracking-[0.2em] text-sl-navy/65',
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
          <div className="flex h-full w-[min(100vw,280px)] flex-col sle-sidebar-panel shadow-2xl shadow-slate-900/15">
            <div className="flex items-center justify-between border-b border-slate-200/90 bg-white/80 px-3 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="sle-logo-bar flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <img
                    src="/sle-brand-kangaroo.png"
                    alt=""
                    className="h-full w-full object-cover object-center"
                    draggable={false}
                  />
                </div>
                <div className="min-w-0 flex flex-col font-body">
                  <span className="truncate text-xs font-bold text-sl-navy">São Luiz Express</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-sl-navy/80">Workspace</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-sl-navy hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div
              ref={mobileNavScrollRef}
              onScroll={(e) => schedulePersistNavScroll(e.currentTarget)}
              className="flex-1 overflow-y-auto px-1 py-2"
            >
              {allSections.map((s) => renderSection(s.id, true, true))}
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
