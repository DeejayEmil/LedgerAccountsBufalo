import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi';
import { UserPublic } from '../types/domain';
import { clearSession, loadSession, saveSession, updateStoredUser } from './storage';
import { onSessionExpired } from './sessionEvents';

interface AuthContextValue {
  user: UserPublic | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<UserPublic>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  // Empieza en `true`: al abrir la app, primero intentamos restaurar la
  // sesión guardada antes de decidir qué stack de navegación mostrar.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user: loggedInUser } = await authApi.login({ email, password });
    await saveSession(accessToken, loggedInUser);
    setUser(loggedInUser);
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const { accessToken, user: newUser } = await authApi.register({ email, password, fullName });
    await saveSession(accessToken, newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  // Si el backend rechaza el token (expiró, o cambió el secreto), no
  // dejamos a la persona atrapada en una pantalla de error: la regresamos
  // al login automáticamente.
  useEffect(() => onSessionExpired(() => void logout()), [logout]);

  // Para cambios de perfil (ej. avatar) resueltos vía GraphQL: actualiza el
  // estado en memoria y lo persiste, sin tocar el access token.
  const updateUser = useCallback(async (patch: Partial<UserPublic>) => {
    setUser((current) => {
      if (!current) {
        return current;
      }
      const updated = { ...current, ...patch };
      void updateStoredUser(updated);
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, updateUser }),
    [user, isLoading, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
