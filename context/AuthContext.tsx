import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient, AuthUser } from '../lib/auth';
import { getDefaultPostLoginPath } from '@/lib/post-login-path';
import { UserData } from '../types';

interface AuthContextType {
  user: UserData | null;
  login: (username: string, password: string) => Promise<{ defaultPath: string }>;
  logout: () => Promise<void>;
  loading: boolean;
  authMessage: string;
  clearAuthMessage: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
        };

        const perms = authResponse.permissions || [];
        const skipGoogle = perms.includes('auth.google_drive.skip');

        if (!skipGoogle) {
          // Conexão Google Drive obrigatória: abre popup e aguarda token ser salvo.
          const popup = window.open(
            `/api/auth/google?username=${encodeURIComponent(u.username || '')}`,
            '_blank',
            'width=600,height=700'
          );

          const startedAt = Date.now();
          const timeoutMs = 2 * 60 * 1000;

          const waitForGoogle = async () => {
            while (Date.now() - startedAt < timeoutMs) {
              if (popup && popup.closed) {
                throw new Error('GOOGLE_POPUP_CLOSED');
              }
              try {
                const st = await authClient.getGoogleStatus(u.username);
                if (st?.connected) return;
              } catch {
                // ignora e tenta de novo
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
            throw new Error('GOOGLE_TIMEOUT');
          };

          await waitForGoogle();
          try {
            if (popup && !popup.closed) popup.close();
          } catch {}
        }

        setUser(u);
        const defaultPath = getDefaultPostLoginPath(authResponse.permissions, u.role);
        return { defaultPath };
      } else {
        throw new Error('Usuário não encontrado');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      if ((error as any)?.message === 'GOOGLE_POPUP_CLOSED') {
        setAuthMessage('Conexão com Google Drive é obrigatória. Faça o login Google para entrar no sistema.');
      } else if ((error as any)?.message === 'GOOGLE_TIMEOUT') {
        setAuthMessage('Tempo esgotado para conectar ao Google Drive. Tente novamente.');
      } else {
        setAuthMessage('');
      }
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
    <AuthContext.Provider value={{ user, login, logout, loading, authMessage, clearAuthMessage: () => setAuthMessage('') }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};