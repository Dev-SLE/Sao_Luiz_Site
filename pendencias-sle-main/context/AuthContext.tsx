import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient, AuthUser } from '../lib/auth';
import { UserData } from '../types';

interface AuthContextType {
  user: UserData | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar se há usuário salvo ao carregar
  useEffect(() => {
    const checkAuth = async () => {
      // Por enquanto, sem persistência de sessão
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      const authResponse = await authClient.login(username, password);
      if (authResponse && authResponse.user) {
        setUser({
          username: authResponse.user.username,
          role: authResponse.user.role,
          linkedOriginUnit: authResponse.user.origin || '',
          linkedDestUnit: authResponse.user.dest || '',
        });
      } else {
        throw new Error('Usuário não encontrado');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authClient.logout();
      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};