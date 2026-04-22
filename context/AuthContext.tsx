'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '../lib/auth';
import { getDefaultPostLoginPath } from '@/lib/post-login-path';
import { UserData } from '../types';

interface AuthContextType {
  user: UserData | null;
  login: (username: string, password: string) => Promise<{ defaultPath: string; mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  /** Re-lê a sessão no servidor (ex.: após trocar senha, o cookie já vem atualizado na resposta). */
  refreshSession: () => Promise<void>;
  loading: boolean;
  authMessage: string;
  clearAuthMessage: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Redireciona para troca de senha antes de qualquer chamada que receberia 428 (ex.: portal /inicio). */
function PasswordChangeEnforcer() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || '';
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user?.mustChangePassword) return;
    if (pathname.includes('/mudar-senha')) return;
    if (pathname.startsWith('/recuperar-senha') || pathname.startsWith('/redefinir-senha')) return;
    router.replace('/app/operacional/mudar-senha');
  }, [loading, user?.mustChangePassword, user?.username, pathname, router]);

  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');

  // Verificar se há usuário salvo ao carregar
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const session = await authClient.getSession();
        if (session?.user) {
          setUser({
            username: session.user.username,
            role: session.user.role,
            linkedOriginUnit: session.user.origin || '',
            linkedDestUnit: session.user.dest || '',
            linkedBiVendedora: session.user.biVendedora || '',
            mustChangePassword: Boolean(session.user.mustChangePassword),
          });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const refreshSession = async () => {
    setLoading(true);
    try {
      const session = await authClient.getSession();
      if (session?.user) {
        setUser({
          username: session.user.username,
          role: session.user.role,
          linkedOriginUnit: session.user.origin || '',
          linkedDestUnit: session.user.dest || '',
          linkedBiVendedora: session.user.biVendedora || '',
          mustChangePassword: Boolean(session.user.mustChangePassword),
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      setAuthMessage('');
        const authResponse = await authClient.login(username, password);
      if (authResponse && authResponse.user) {
        const u = {
          username: authResponse.user.username,
          role: authResponse.user.role,
          linkedOriginUnit: authResponse.user.origin || '',
          linkedDestUnit: authResponse.user.dest || '',
          linkedBiVendedora: authResponse.user.biVendedora || '',
          mustChangePassword: Boolean(authResponse.user.mustChangePassword),
        };

        setUser(u);
        const defaultPath = getDefaultPostLoginPath(authResponse.permissions, u.role, u.username);
        return { defaultPath, mustChangePassword: Boolean(u.mustChangePassword) };
      } else {
        throw new Error('Usuário não encontrado');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      setAuthMessage('');
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authClient.logout();
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        refreshSession,
        loading,
        authMessage,
        clearAuthMessage: () => setAuthMessage(''),
      }}
    >
      <PasswordChangeEnforcer />
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};