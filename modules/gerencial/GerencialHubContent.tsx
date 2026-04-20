'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { BarChart3, LineChart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ModuleSubnavTabs } from '@/components/workspace/ModuleSubnavTabs';
import {
  GERENCIAL_COMERCIAL_PANELS,
  GERENCIAL_SECTORS,
  gerencialHubPath,
  isGerencialSectorSlug,
  type GerencialSectorSlug,
} from '@/modules/gerencial/routes';
import { GERENCIAL_BI_TAB } from '@/modules/gerencial/permissions';
import { BiComissoesDashboard } from '@/modules/gerencial/BiComissoesDashboard';
import { BiFunilVendasDashboard } from '@/modules/gerencial/BiFunilVendasDashboard';
import { BiSprintVendasDashboard } from '@/modules/gerencial/BiSprintVendasDashboard';
import { BiMetasPerformanceDashboard } from '@/modules/gerencial/BiMetasPerformanceDashboard';
import { ComissoesHoleriteView } from '@/modules/gerencial/ComissoesHoleriteView';
import { hasPermissionWithAliases } from '@/lib/permissions';

type ParsedGerencial = {
  sector: GerencialSectorSlug;
  panel: string | null;
  holerite: boolean;
};

function parseGerencialPath(pathname: string): ParsedGerencial {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'app' || parts[1] !== 'gerencial') {
    return { sector: 'comercial', panel: null, holerite: false };
  }
  const a = parts[2]?.toLowerCase() ?? '';
  const b = parts[3]?.toLowerCase() ?? '';
  const c = parts[4]?.toLowerCase() ?? '';
  if (!a) return { sector: 'comercial', panel: null, holerite: false };
  if (isGerencialSectorSlug(a)) {
    return {
      sector: a,
      panel: b || null,
      holerite: b === 'comissoes' && c === 'holerite',
    };
  }
  return {
    sector: 'comercial',
    panel: a || null,
    holerite: a === 'comissoes' && b === 'holerite',
  };
}

function commercialTabKeyFromPanelSlug(slug: string): keyof typeof GERENCIAL_BI_TAB | null {
  if (slug === 'comissoes') return 'comissoes';
  if (slug === 'performance-vendas') return 'funil';
  if (slug === 'sprint-incentivos') return 'sprint';
  if (slug === 'metas-performance') return 'metas';
  return null;
}

export function GerencialHubContent({ pathname }: { pathname: string }) {
  const livePath = usePathname();
  const router = useRouter();
  const effectivePath = livePath || pathname;
  const parsed = useMemo(() => parseGerencialPath(effectivePath), [effectivePath]);
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
      } catch {
        if (!cancelled) setPermissions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const has = useMemo(() => {
    return (key: string) => hasPermissionWithAliases(permissions, key);
  }, [permissions]);

  const sectorTabs = useMemo(() => {
    return GERENCIAL_SECTORS.filter((s) => has(s.permission) || has('module.gerencial.view')).map((s) => ({
      href: gerencialHubPath(s.slug),
      label: s.label,
      active: parsed.sector === s.slug,
    }));
  }, [has, parsed.sector]);

  const allowedCommercialPanels = useMemo(() => {
    return GERENCIAL_COMERCIAL_PANELS.filter((p) => has(p.permission) || has('module.gerencial.view'));
  }, [has]);

  const commercialSubTabs = useMemo(() => {
    if (parsed.sector !== 'comercial') return [];
    return allowedCommercialPanels.map((p) => ({
      href: gerencialHubPath('comercial', p.slug),
      label: p.label,
      active:
        p.slug === 'comissoes'
          ? (parsed.panel === 'comissoes' || parsed.holerite) && parsed.sector === 'comercial'
          : parsed.panel === p.slug && parsed.sector === 'comercial',
    }));
  }, [allowedCommercialPanels, parsed.holerite, parsed.panel, parsed.sector]);

  /** URLs legadas `/app/gerencial/comissoes` → `/app/gerencial/comercial/comissoes`. */
  useEffect(() => {
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    const seg2 = parts[2]?.toLowerCase() ?? '';
    if (!seg2) return;
    if (!isGerencialSectorSlug(seg2)) {
      const rest = parts.slice(2).join('/');
      router.replace(`/app/gerencial/comercial/${rest}`);
    }
  }, [effectivePath, router]);

  /** `/app/gerencial` → primeiro setor permitido no catálogo. */
  useEffect(() => {
    if (permissions === null) return;
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    if (parts.length > 2) return;
    const firstSector = GERENCIAL_SECTORS.find((s) => has(s.permission) || has('module.gerencial.view'))?.slug;
    if (firstSector) router.replace(gerencialHubPath(firstSector));
  }, [effectivePath, has, permissions, router]);

  /** `/app/gerencial/comercial` sem painel → primeiro painel Comercial permitido. */
  useEffect(() => {
    if (permissions === null) return;
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    if (parts.length !== 3) return;
    if (parts[2]?.toLowerCase() !== 'comercial') return;
    const first = allowedCommercialPanels[0]?.slug;
    if (first) router.replace(gerencialHubPath('comercial', first));
  }, [allowedCommercialPanels, effectivePath, permissions, router]);

  const canAnySector = sectorTabs.length > 0;
  const canCommercial = has(GERENCIAL_BI_TAB.setorComercial) || has('module.gerencial.view');

  const sectorDenied =
    permissions !== null &&
    ((parsed.sector === 'comercial' && !canCommercial) ||
      (parsed.sector === 'financeiro' && !has(GERENCIAL_BI_TAB.setorFinanceiro) && !has('module.gerencial.view')) ||
      (parsed.sector === 'operacao' && !has(GERENCIAL_BI_TAB.setorOperacao) && !has('module.gerencial.view')));

  const panelKey = parsed.panel ? commercialTabKeyFromPanelSlug(parsed.panel) : null;
  const commercialPanelDenied =
    parsed.sector === 'comercial' &&
    permissions !== null &&
    !!parsed.panel &&
    !parsed.holerite &&
    (!panelKey || !has(GERENCIAL_BI_TAB[panelKey])) &&
    !has('module.gerencial.view');

  const holeriteDenied =
    parsed.holerite &&
    permissions !== null &&
    !has('module.gerencial.comissoes_holerite') &&
    !has('module.gerencial.view') &&
    !(has(GERENCIAL_BI_TAB.setorComercial) && has(GERENCIAL_BI_TAB.comissoes));

  if (permissions === null) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="animate-spin text-sl-navy" size={28} />
        <span className="text-sm">Carregando permissões…</span>
      </div>
    );
  }

  if (!canAnySector) {
    return (
      <div className="surface-card mx-auto max-w-lg p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">Sem acesso ao Gerencial</p>
        <p className="mt-2 text-sm text-slate-600">Peça ao administrador as permissões de setor (Comercial, Financeiro ou Operação).</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="border-b border-border bg-white/90 px-4 pt-1">
        <ModuleSubnavTabs tabs={sectorTabs} />
        {parsed.sector === 'comercial' && commercialSubTabs.length > 0 ? (
          <div className="mt-1 border-t border-slate-100 pt-1">
            <ModuleSubnavTabs tabs={commercialSubTabs} size="sm" underlineClass="after:bg-amber-500" />
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-50/80 px-4 py-4 md:px-6">
        {sectorDenied || commercialPanelDenied || holeriteDenied ? (
          <div className="surface-card mx-auto max-w-lg p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">Acesso negado</p>
            <p className="mt-2 text-sm text-slate-600">Você não tem permissão para esta área. Solicite o ajuste no perfil de permissões.</p>
          </div>
        ) : parsed.sector === 'financeiro' ? (
          <PlaceholderSector
            title="Financeiro"
            description="Indicadores financeiros do BI por setor serão disponibilizados aqui. A estrutura de permissões e escopo por unidade já está preparada."
          />
        ) : parsed.sector === 'operacao' ? (
          <PlaceholderSector
            title="Operação"
            description="Painéis operacionais do BI por setor serão disponibilizados aqui. A estrutura de permissões e escopo por unidade já está preparada."
          />
        ) : parsed.holerite ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando holerite…</span>
              </div>
            }
          >
            <ComissoesHoleriteView />
          </Suspense>
        ) : parsed.panel === 'comissoes' ? (
          <BiComissoesDashboard />
        ) : parsed.panel === 'performance-vendas' ? (
          <BiFunilVendasDashboard />
        ) : parsed.panel === 'sprint-incentivos' ? (
          <BiSprintVendasDashboard />
        ) : parsed.panel === 'metas-performance' ? (
          <BiMetasPerformanceDashboard />
        ) : (
          <div className="surface-card mx-auto max-w-2xl p-8 animate-in fade-in duration-200">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <LineChart className="text-sl-navy" size={22} strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Comercial</h2>
            <p className="mt-2 text-sm text-slate-600">Escolha um painel nas abas acima ou use os atalhos abaixo.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {allowedCommercialPanels.map((p) => (
                <Link
                  key={p.slug}
                  href={gerencialHubPath('comercial', p.slug)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-sl-navy shadow-sm transition hover:border-sl-navy/30 hover:bg-slate-50"
                >
                  <BarChart3 size={18} strokeWidth={2} />
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderSector({ title, description }: { title: string; description: string }) {
  return (
    <div className="surface-card mx-auto max-w-2xl p-8 animate-in fade-in duration-200">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
        <LineChart className="text-sl-navy" size={22} strokeWidth={2} />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
