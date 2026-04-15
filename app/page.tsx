'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace('/inicio');
  }, [user, loading, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#cfd9e8] text-slate-600">
      <p className="text-sm">Redirecionando…</p>
    </div>
  );
}
