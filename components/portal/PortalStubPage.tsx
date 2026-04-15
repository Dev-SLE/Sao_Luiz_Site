'use client';

import Link from 'next/link';

type Props = {
  title: string;
  description: string;
};

export function PortalStubPage({ title, description }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-sl-red">Portal</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">{title}</h1>
      <p className="mt-4 text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/inicio" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary">
          Voltar ao início
        </Link>
        <Link href="/app/operacional/visao-geral" className="rounded-lg bg-sl-navy px-4 py-2 text-sm font-medium text-white hover:bg-sl-navy-light">
          Área de trabalho
        </Link>
      </div>
    </div>
  );
}
