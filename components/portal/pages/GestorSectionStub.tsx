'use client';

import Link from 'next/link';

type Props = { title: string; description: string };

export function GestorSectionStub({ title, description }: Props) {
  return (
    <div className="min-h-screen bg-background px-6 pb-20 pt-28">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8">
        <Link href="/gestor" className="text-sm font-semibold text-sl-red hover:underline">
          Ir à visão geral do gestor
        </Link>
        <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
        <ul className="mt-6 list-inside list-disc text-sm text-muted-foreground">
          <li>Lista e filtros virão da mesma base de permissões e escopo de setor.</li>
          <li>Integração com DP/RH e operacional na Fase 2+.</li>
        </ul>
      </div>
    </div>
  );
}
