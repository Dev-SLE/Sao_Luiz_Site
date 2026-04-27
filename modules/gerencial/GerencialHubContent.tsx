'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { BarChart3, LineChart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ModuleSubnavTabs } from '@/components/workspace/ModuleSubnavTabs';
import {
  GERENCIAL_COMERCIAL_PANELS,
  GERENCIAL_FINANCEIRO_PANELS,
  GERENCIAL_OPERACAO_PANELS,
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
import { BiSimuladorMetasDashboard } from '@/modules/gerencial/BiSimuladorMetasDashboard';
import { BiPlanejamentoAgenciasDashboard } from '@/modules/gerencial/BiPlanejamentoAgenciasDashboard';
import { BiTabelasCombinadasDashboard } from '@/modules/gerencial/BiTabelasCombinadasDashboard';
import { BiFluxoMonitorDashboard } from '@/modules/gerencial/BiFluxoMonitorDashboard';
import { BiTaxasGerencialDashboard } from '@/modules/gerencial/BiTaxasGerencialDashboard';
import { BiOperacaoVisaoGeralDashboard } from '@/modules/gerencial/BiOperacaoVisaoGeralDashboard';
import { DesempenhoAgenciasPage } from '@/modules/operacional/pages/DesempenhoAgencias';
import { RotasOperacionaisPage } from '@/modules/operacional/pages/RotasOperacionais';
import { BiComercial360CockpitDashboard } from '@/modules/gerencial/comercial360/BiComercial360CockpitDashboard';
import { BiComercial360ExecutivaDashboard } from '@/modules/gerencial/comercial360/BiComercial360ExecutivaDashboard';
import { BiComercial360GapDashboard } from '@/modules/gerencial/comercial360/BiComercial360GapDashboard';
import { BiComercial360RadarDashboard } from '@/modules/gerencial/comercial360/BiComercial360RadarDashboard';
import { BiComercial360RiscoDashboard } from '@/modules/gerencial/comercial360/BiComercial360RiscoDashboard';
import { ComissoesHoleriteView } from '@/modules/gerencial/ComissoesHoleriteView';
import { useData } from '@/context/DataContext';
import { FinanceiroBiInicialDashboard } from '@/modules/financeiro/FinanceiroBiInicialDashboard';
import { FinanceiroBiTesourariaDashboard } from '@/modules/financeiro/FinanceiroBiTesourariaDashboard';

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
  if (slug === 'carteira-renovacao') return 'carteiraRenovacao';
  if (slug === 'performance-vendas') return 'funil';
  if (slug === 'sprint-incentivos') return 'sprint';
  if (slug === 'metas-performance') return 'metas';
  if (slug === 'simulador-metas-vendedoras') return 'metas';
  if (slug === 'planejamento-agencias') return 'metas';
  if (slug === 'cockpit-comercial-360') return 'comercial360Cockpit';
  if (slug === 'central-360-executiva') return 'comercial360Executiva';
  if (slug === 'monitor-risco-360') return 'comercial360Risco';
  if (slug === 'potencial-gap-360') return 'comercial360Gap';
  if (slug === 'radar-prospeccao-360') return 'comercial360Radar';
  return null;
}

function operacaoTabKeyFromPanelSlug(slug: string): keyof typeof GERENCIAL_BI_TAB | null {
  if (slug === 'visao-geral-operacional') return 'setorOperacao';
  if (slug === 'monitor-fluxo') return 'fluxoMonitor';
  if (slug === 'gestao-taxas') return 'taxasGerencial';
  if (slug === 'desempenho-agencias') return 'setorOperacao';
  if (slug === 'rotas-operacionais') return 'setorOperacao';
  return null;
}

export function GerencialHubContent({ pathname }: { pathname: string }) {
  const livePath = usePathname();
  const router = useRouter();
  const effectivePath = livePath || pathname;
  const parsed = useMemo(() => parseGerencialPath(effectivePath), [effectivePath]);
  const { hasPermission } = useData();
  const has = hasPermission;

  const sectorTabs = useMemo(() => {
    return GERENCIAL_SECTORS.filter((s) => {
      if (s.slug === 'financeiro') {
        return has(s.permission) || has(GERENCIAL_BI_TAB.setorFinanceiro);
      }
      return has(s.permission);
    }).map((s) => ({
      href: gerencialHubPath(s.slug),
      label: s.label,
      active: parsed.sector === s.slug,
    }));
  }, [has, parsed.sector]);

  const allowedCommercialPanels = useMemo(() => {
    return GERENCIAL_COMERCIAL_PANELS.filter((p) => has(p.permission));
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

  const allowedOperacaoPanels = useMemo(() => {
    return GERENCIAL_OPERACAO_PANELS.filter((p) => has(p.permission));
  }, [has]);

  const allowedFinanceiroPanels = useMemo(() => {
    return GERENCIAL_FINANCEIRO_PANELS.filter(
      (p) => has(p.permission) || has(GERENCIAL_BI_TAB.setorFinanceiro)
    );
  }, [has]);

  const financeiroSubTabs = useMemo(() => {
    if (parsed.sector !== 'financeiro') return [];
    return allowedFinanceiroPanels.map((p) => ({
      href: gerencialHubPath('financeiro', p.slug),
      label: p.label,
      active: parsed.panel === p.slug && parsed.sector === 'financeiro',
    }));
  }, [allowedFinanceiroPanels, parsed.panel, parsed.sector]);

  const operacaoSubTabs = useMemo(() => {
    if (parsed.sector !== 'operacao') return [];
    return allowedOperacaoPanels.map((p) => ({
      href: gerencialHubPath('operacao', p.slug),
      label: p.label,
      active: parsed.panel === p.slug && parsed.sector === 'operacao',
    }));
  }, [allowedOperacaoPanels, parsed.panel, parsed.sector]);

  /** URLs legadas `/app/gerencial/comissoes` para `/app/gerencial/comercial/comissoes`. */
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

  /** `/app/gerencial` para o primeiro setor permitido no catalogo. */
  useEffect(() => {
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    if (parts.length > 2) return;
    const firstSector = GERENCIAL_SECTORS.find((s) => {
      if (s.slug === 'financeiro') return has(s.permission) || has(GERENCIAL_BI_TAB.setorFinanceiro);
      return has(s.permission);
    })?.slug;
    if (firstSector) router.replace(gerencialHubPath(firstSector));
  }, [effectivePath, has, router]);

  /** `/app/gerencial/comercial` sem painel: primeiro painel Comercial permitido. */
  useEffect(() => {
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    if (parts.length !== 3) return;
    if (parts[2]?.toLowerCase() !== 'comercial') return;
    const first = allowedCommercialPanels[0]?.slug;
    if (first) router.replace(gerencialHubPath('comercial', first));
  }, [allowedCommercialPanels, effectivePath, router]);

  /** `/app/gerencial/operacao` sem painel: primeiro painel Operacao permitido. */
  useEffect(() => {
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    if (parts.length !== 3) return;
    if (parts[2]?.toLowerCase() !== 'operacao') return;
    const first = allowedOperacaoPanels[0]?.slug;
    if (first) router.replace(gerencialHubPath('operacao', first));
  }, [allowedOperacaoPanels, effectivePath, router]);

  /** `/app/gerencial/financeiro` sem painel: primeiro painel Financeiro permitido. */
  useEffect(() => {
    const parts = effectivePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'app' || parts[1] !== 'gerencial') return;
    if (parts.length !== 3) return;
    if (parts[2]?.toLowerCase() !== 'financeiro') return;
    const first = allowedFinanceiroPanels[0]?.slug;
    if (first) router.replace(gerencialHubPath('financeiro', first));
  }, [allowedFinanceiroPanels, effectivePath, router]);

  const canAnySector = sectorTabs.length > 0;
  const canCommercial = has(GERENCIAL_BI_TAB.setorComercial);

  const sectorDenied =
    (parsed.sector === 'comercial' && !canCommercial) ||
    (parsed.sector === 'financeiro' &&
      !has('module.financeiro.view') &&
      !has(GERENCIAL_BI_TAB.setorFinanceiro)) ||
    (parsed.sector === 'operacao' && !has(GERENCIAL_BI_TAB.setorOperacao));

  const panelKey = parsed.panel ? commercialTabKeyFromPanelSlug(parsed.panel) : null;
  const commercialPanelDenied =
    parsed.sector === 'comercial' &&
    !!parsed.panel &&
    !parsed.holerite &&
    (!panelKey || !has(GERENCIAL_BI_TAB[panelKey]));

  const operacaoPanelKey = parsed.panel ? operacaoTabKeyFromPanelSlug(parsed.panel) : null;
  const operacaoPanelDenied =
    parsed.sector === 'operacao' &&
    !!parsed.panel &&
    (!operacaoPanelKey || !has(GERENCIAL_BI_TAB[operacaoPanelKey]));

  const financeiroPanelDenied =
    parsed.sector === 'financeiro' &&
    !!parsed.panel &&
    !allowedFinanceiroPanels.some((p) => p.slug === parsed.panel);

  const holeriteDenied =
    parsed.holerite &&
    !has('module.gerencial.comissoes_holerite') &&
    !(has(GERENCIAL_BI_TAB.setorComercial) && has(GERENCIAL_BI_TAB.comissoes));

  if (!canAnySector) {
    return (
      <div className="surface-card mx-auto max-w-lg p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">Sem acesso ao Gerencial</p>
        <p className="mt-2 text-sm text-slate-600">
          Peça ao administrador as permissões de setor (Comercial, Financeiro ou Operação).
        </p>
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
        {parsed.sector === 'operacao' && operacaoSubTabs.length > 0 ? (
          <div className="mt-1 border-t border-slate-100 pt-1">
            <ModuleSubnavTabs tabs={operacaoSubTabs} size="sm" underlineClass="after:bg-emerald-600" />
          </div>
        ) : null}
        {parsed.sector === 'financeiro' && financeiroSubTabs.length > 0 ? (
          <div className="mt-1 border-t border-slate-100 pt-1">
            <ModuleSubnavTabs tabs={financeiroSubTabs} size="sm" underlineClass="after:bg-sky-600" />
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-50/80 px-4 py-4 md:px-6">
        {sectorDenied ||
        commercialPanelDenied ||
        operacaoPanelDenied ||
        financeiroPanelDenied ||
        holeriteDenied ? (
          <div className="surface-card mx-auto max-w-lg p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">Acesso negado</p>
            <p className="mt-2 text-sm text-slate-600">
              Você não tem permissão para esta área. Solicite o ajuste no perfil de permissões.
            </p>
          </div>
        ) : parsed.sector === 'financeiro' && parsed.panel === 'bi-inicial' ? (
          <FinanceiroBiInicialDashboard />
        ) : parsed.sector === 'financeiro' && parsed.panel === 'tesouraria-fluxo' ? (
          <FinanceiroBiTesourariaDashboard />
        ) : parsed.sector === 'financeiro' ? (
          <PlaceholderSector
            title="Financeiro"
            description="Escolha o painel na barra acima."
          />
        ) : parsed.sector === 'operacao' && parsed.panel === 'visao-geral-operacional' ? (
          <BiOperacaoVisaoGeralDashboard />
        ) : parsed.sector === 'operacao' && parsed.panel === 'monitor-fluxo' ? (
          <BiFluxoMonitorDashboard />
        ) : parsed.sector === 'operacao' && parsed.panel === 'gestao-taxas' ? (
          <BiTaxasGerencialDashboard />
        ) : parsed.sector === 'operacao' && parsed.panel === 'desempenho-agencias' ? (
          <DesempenhoAgenciasPage />
        ) : parsed.sector === 'operacao' && parsed.panel === 'rotas-operacionais' ? (
          <RotasOperacionaisPage />
        ) : parsed.sector === 'operacao' ? (
          <PlaceholderSector
            title="Operação"
            description="Escolha um painel na barra acima ou aguarde novos indicadores logísticos neste setor."
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
        ) : parsed.panel === 'carteira-renovacao' ? (
          <BiTabelasCombinadasDashboard />
        ) : parsed.panel === 'comissoes' ? (
          <BiComissoesDashboard />
        ) : parsed.panel === 'performance-vendas' ? (
          <BiFunilVendasDashboard />
        ) : parsed.panel === 'sprint-incentivos' ? (
          <BiSprintVendasDashboard />
        ) : parsed.panel === 'metas-performance' ? (
          <BiMetasPerformanceDashboard />
        ) : parsed.panel === 'simulador-metas-vendedoras' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando simulador…</span>
              </div>
            }
          >
            <BiSimuladorMetasDashboard />
          </Suspense>
        ) : parsed.panel === 'planejamento-agencias' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando planejamento…</span>
              </div>
            }
          >
            <BiPlanejamentoAgenciasDashboard />
          </Suspense>
        ) : parsed.panel === 'cockpit-comercial-360' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando Comercial 360…</span>
              </div>
            }
          >
            <BiComercial360CockpitDashboard />
          </Suspense>
        ) : parsed.panel === 'central-360-executiva' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando Comercial 360…</span>
              </div>
            }
          >
            <BiComercial360ExecutivaDashboard />
          </Suspense>
        ) : parsed.panel === 'monitor-risco-360' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando Comercial 360…</span>
              </div>
            }
          >
            <BiComercial360RiscoDashboard />
          </Suspense>
        ) : parsed.panel === 'potencial-gap-360' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando Comercial 360…</span>
              </div>
            }
          >
            <BiComercial360GapDashboard />
          </Suspense>
        ) : parsed.panel === 'radar-prospeccao-360' ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
                <Loader2 className="animate-spin text-sl-navy" size={28} />
                <span className="text-sm">Carregando Comercial 360…</span>
              </div>
            }
          >
            <BiComercial360RadarDashboard />
          </Suspense>
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
