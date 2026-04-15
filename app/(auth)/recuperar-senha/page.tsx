'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 via-[#f5f7fa] to-slate-200 px-4 py-10">
    <div className="w-full max-w-lg flex-1 flex-col justify-center rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-lg backdrop-blur">
      <h1 className="text-lg font-bold text-slate-900">Recuperar senha</h1>
      <p className="mt-2 text-sm text-slate-600">
        Informe o e-mail corporativo. Quando o fluxo de e-mail estiver configurado no servidor, você receberá o link
        para redefinição.
      </p>
      {sent ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Se o e-mail existir em nossa base, enviaremos as instruções em instantes (simulação de UI).
        </p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-sl-navy/25 focus:ring-2"
              placeholder="voce@empresa.com.br"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-sl-navy py-2.5 text-sm font-semibold text-white hover:bg-sl-navy-light"
          >
            Enviar instruções
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-sl-navy hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
    </div>
  );
}
