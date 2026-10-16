import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { get, getApiUrl, normalizeUrl, patch, post, setApiUrl, setToken, setUnauthorizedHandler } from './api';
import type { Macros, User } from './types';

const KEY = 'calrecipe.token';
const SERVER_KEY = 'calrecipe.server';

// SecureStore is native-only; fall back to localStorage on web.
const kv = (key: string) => ({
  get: () => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key)),
  set: (v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(key, v)) : SecureStore.setItemAsync(key, v)),
  clear: () => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : SecureStore.deleteItemAsync(key)),
});
const store = kv(KEY);
const serverStore = kv(SERVER_KEY);

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (name: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (changes: { name?: string; goals?: Partial<Macros> }) => Promise<void>;
  serverUrl: string;
  /** Save a different server address (null = default). Signs out, since accounts live on the server. */
  changeServer: (url: string | null) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState(getApiUrl());

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await store.clear();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      try {
        const savedServer = await serverStore.get();
        if (savedServer) setServerUrl(setApiUrl(savedServer));
        const saved = await store.get();
        if (saved) {
          setToken(saved);
          const { user } = await get<{ user: User }>('/auth/me');
          setUser(user);
        }
      } catch (e: any) {
        // Keep the token if the server is just unreachable; drop it if it was rejected.
        if (e?.status === 401) await signOut();
      } finally {
        setLoading(false);
      }
    })();
  }, [signOut]);

  const finish = async ({ token, user }: { token: string; user: User }) => {
    setToken(token);
    await store.set(token);
    setUser(user);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signOut,
      signIn: async (username, password) => finish(await post('/auth/login', { username, password })),
      signUp: async (name, username, password) => finish(await post('/auth/register', { name, username, password })),
      updateProfile: async (changes) => setUser((await patch<{ user: User }>('/auth/me', changes)).user),
      serverUrl,
      changeServer: async (url) => {
        await signOut();
        if (url) await serverStore.set(normalizeUrl(url));
        else await serverStore.clear();
        setServerUrl(setApiUrl(url));
      },
    }),
    [user, loading, signOut, serverUrl],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
