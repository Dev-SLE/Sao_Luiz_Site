'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function RedefinirSenhaForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

  return (
    <div className="flex flex-1 flex-col justify-center rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-lg backdrop-blur">
      <h1 className="text-lg font-bold text-slate-900">Nova senha</h1>
      <p className="mt-2 text-sm text-slate-600">
        Defina uma senha forte. A validação do token e a gravação ocorrerão via API dedicada (Fase 1 — shell de rota).
      </p>
      {!token && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Link inválido ou expirado. Solicite nova recuperação.
        </p>
      )}
      {done ? (
        <p className="mt-4 text-sm text-emerald-800">
          Senha atualizada (simulação). <Link href="/login" className="font-semibold underline">Entrar</Link>
        </p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nova senha</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-sl-navy/25 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            disabled={!token}
            className="w-full rounded-lg bg-sl-red py-2.5 text-sm font-semibold text-white hover:bg-[#9e0f26] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Salvar nova senha
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-sl-navy hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#dbe7ff] via-[#cfd9e8] to-[#c4d2e6] px-4 py-10">
      <Suspense fallback={<p className="text-sm text-slate-600">Carregando…</p>}>
        <RedefinirSenhaForm />
      </Suspense>
    </div>
  );
}
