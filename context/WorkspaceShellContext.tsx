'use client';

import React, { createContext, useContext } from 'react';
import { Page } from '@/types';

export type WorkspaceShellUser = { username: string };

type WorkspaceShellValue = {
  user: WorkspaceShellUser;
  logout: () => Promise<void>;
  navigateToPage: (p: Page) => void;
  themeDark: boolean;
  setThemeDark: React.Dispatch<React.SetStateAction<boolean>>;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const WorkspaceShellContext = createContext<WorkspaceShellValue | null>(null);

export function WorkspaceShellProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceShellValue;
}) {
  return <WorkspaceShellContext.Provider value={value}>{children}</WorkspaceShellContext.Provider>;
}

export function useWorkspaceShell(): WorkspaceShellValue {
  const ctx = useContext(WorkspaceShellContext);
  if (!ctx) {
    throw new Error('useWorkspaceShell must be used within WorkspaceShellProvider');
  }
  return ctx;
}
