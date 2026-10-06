import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, bootstrapCsrf, login, logout as apiLogout, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => {
    let alive = true;
    let restoringSession = true;
    setUnauthorizedHandler(() => {
      if (alive && !restoringSession) {
        setUser(null);
        setAuthError('Your session expired. Sign in to continue.');
      }
    });
    async function restoreSession() {
      try {
        await bootstrapCsrf();
        const session = await api.get('/auth/me');
        if (alive) {
          setUser(session.user);
          setAuthError('');
          setSignOutError('');
        }
      } catch (error) {
        if (alive && error.status !== 401) setAuthError(error.message);
      } finally {
        restoringSession = false;
        if (alive) setLoading(false);
      }
    }
    restoreSession();
    return () => {
      alive = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const signIn = useCallback(async (credentials) => {
    setAuthError('');
    const session = await login(credentials);
    setUser(session.user);
  }, []);
  const signOut = useCallback(async () => {
    setSignOutError('');
    try {
      await apiLogout();
      setUser(null);
    } catch (error) {
      setSignOutError(error.message);
      throw error;
    }
  }, []);
  const value = useMemo(() => ({ user, loading, authError, signIn, signOut, signOutError }), [user, loading, authError, signIn, signOut, signOutError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be inside AuthProvider');
  return value;
}
