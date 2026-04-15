import Link from 'next/link';

export function PortalFooter() {
  return (
    <footer className="bg-sl-navy px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sl-red">
            <span className="font-heading text-sm font-bold text-white">SL</span>
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-white">Portal São Luiz Express</p>
            <p className="text-xs text-white/40">Conectando pessoas, operações e resultados.</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-white/40">
          <span className="cursor-not-allowed hover:text-white/60">Política de Privacidade</span>
          <span className="cursor-not-allowed hover:text-white/60">Termos de Uso</span>
          <Link href="/suporte" className="transition-colors hover:text-white">
            Suporte
          </Link>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} São Luiz Express. Uso interno.</p>
      </div>
    </footer>
  );
}
