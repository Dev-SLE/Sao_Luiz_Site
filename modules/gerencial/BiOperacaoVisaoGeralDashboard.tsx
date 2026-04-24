'use client';

import React from 'react';
import Dashboard from '@/components/Dashboard';
import { useData } from '@/context/DataContext';
import { WorkspaceNoAccess } from '@/components/workspace/WorkspaceNoAccess';

/**
 * Visao Geral operacional movida para Gerencial > Operacao.
 * Mantem o dataset operacional canônico, com contexto de governança no topo.
 */
export function BiOperacaoVisaoGeralDashboard() {
  const { hasPermission } = useData();
  if (!hasPermission('VIEW_DASHBOARD')) {
    return <WorkspaceNoAccess message="Seu perfil não possui acesso à Visão geral operacional." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Gerencial • Operação</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Visão geral operacional</h2>
        <p className="mt-1 text-sm text-slate-600">
          Indicadores consolidados com total distinto por CTE+série (sem concluídos), para evitar dupla contagem entre filas.
        </p>
      </section>
      <Dashboard />
    </div>
  );
}

