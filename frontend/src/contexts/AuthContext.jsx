import { createContext, useState, useEffect, useCallback } from 'react';
import { tokenStore } from '../api/client';
import { authApi } from '../api/auth';
import { usersApi } from '../api/index';

export const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const token = tokenStore.getAccess();
    if (!token) {
      setLoading(false);
      return;
    }
    const payload = parseJwt(token);
    if (!payload || payload.exp * 1000 < Date.now()) {
      tokenStore.clear();
      setLoading(false);
      return;
    }
    try {
      const profile = await usersApi.getProfile();
      setUser({ ...payload, ...profile });
    } catch {
      tokenStore.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = async (identifier, password) => {
    const data = await authApi.login(identifier, password);
    const payload = parseJwt(data.accessToken);
    const profile = await usersApi.getProfile();
    const mergedUser = { ...payload, ...profile };
    setUser(mergedUser);
    return { ...data, user: mergedUser };
  };

  const googleLogin = async (idToken) => {
    const data = await authApi.googleAuth(idToken);
    const payload = parseJwt(data.accessToken);
    const profile = await usersApi.getProfile();
    const mergedUser = { ...payload, ...profile };
    setUser(mergedUser);
    return { ...data, user: mergedUser };
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateUser = (updates) => setUser((prev) => ({ ...prev, ...updates }));

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
