import { createContext, ReactNode, useContext, useState } from 'react';

const TOKEN_KEY = 'findit-token';

// What every page can read or call through useAuth().
interface AuthContextValue {
  token: string;
  signIn: (token: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Keeps the session token in one place for the whole application.
// The token is also saved in localStorage, so the user stays signed in after a refresh.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');

  function signIn(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  }

  return (
    <AuthContext.Provider value={{ token, signIn, signOut }}>{children}</AuthContext.Provider>
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
