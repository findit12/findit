import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

const TOKEN_KEY = 'findit-token';

// What every page can read or call through useAuth().
interface AuthContextValue {
  token: string;
  userId: number | null; // id of the signed-in user, read from the token
  signIn: (token: string) => void;
  signOut: () => void;
}

// A session token (JWT) has three parts separated by dots. The middle part is JSON, encoded in
// base64url, and its "sub" field is the user id. Reading it needs no secret; only the server can
// check that the token is genuine, so this id is used for display only (for example to show the
// Edit button), never for security.
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

// Keeps the session token in one place for the whole application.
// The token is also saved in localStorage, so the user stays signed in after a refresh.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');

  // useCallback keeps the same function between renders, so pages can safely list
  // signOut in the dependencies of their useEffect.
  const signIn = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  }, []);

  const userId = token ? userIdFromToken(token) : null;

  return (
    <AuthContext.Provider value={{ token, userId, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

// Gives access to the token and to signIn / signOut from any component.
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
