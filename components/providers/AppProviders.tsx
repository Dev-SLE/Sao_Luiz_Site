'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { DataProvider as GlobalDataProvider } from '@/context/DataContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GlobalDataProvider>{children}</GlobalDataProvider>
    </AuthProvider>
  );
}
