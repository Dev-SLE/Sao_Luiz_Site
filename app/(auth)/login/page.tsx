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
        <div className="flex min-h-dvh items-center justify-center bg-[#cfd9e8] text-slate-600">
          <p className="text-sm">Carregando…</p>
        </div>
      }
    >
      <LoginGate />
    </Suspense>
  );
}
