'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/components/Login';
import { useAuth } from '@/context/AuthContext';

function LoginGate() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/inicio');
    }
  }, [user, loading, router]);

  if (!loading && user) {
    return null;
  }

  return <Login />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          data-theme="portal"
          className="font-body flex min-h-dvh flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-100 to-slate-200/90 text-sl-navy"
        >
          <div className="h-10 w-10 animate-spin rounded-xl border-2 border-sl-navy/30 border-t-sl-red" aria-hidden />
          <p className="text-sm font-medium text-slate-600">Carregando portal…</p>
        </div>
      }
    >
      <LoginGate />
    </Suspense>
  );
}
