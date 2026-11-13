import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api';

const TOKEN_KEY = 'findit-token';

interface AuthContextValue {
  token: string;
  userId: number | null;
  role: string | null;
  signIn: (token: string) => void;
  signOut: () => void;
}

function userIdFromToken(token: string): number | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part)) as { sub?: string };
    return payload.sub ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [role, setRole] = useState<string | null>(null);

  const signIn = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setRole(null);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setRole(null);
  }, []);

  useEffect(() => {
    let active = true;

    if (!token) {
      setRole(null);
      return () => {
        active = false;
      };
    }

    apiRequest<{ role: string }>('/auth/me', { token })
      .then((profile) => {
        if (active) setRole(profile.role);
      })
      .catch(() => {
        if (active) setRole(null);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const userId = token ? userIdFromToken(token) : null;

  return (
    <AuthContext.Provider value={{ token, userId, role, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
