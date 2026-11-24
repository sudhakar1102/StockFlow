import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const finish = (d) => {
    setToken(d.token);
    setUser(d.user);
  };

  const value = {
    user,
    loading,
    login: async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    signup: async (form) => finish(await api('/auth/signup', { method: 'POST', body: form })),
    logout: () => {
      setToken(null);
      setUser(null);
    },
    setDefaultThreshold: (n) => setUser((u) => (u ? { ...u, default_low_stock_threshold: n } : u)),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
