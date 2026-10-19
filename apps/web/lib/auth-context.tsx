'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { api, parseProblem, setTokenProvider } from './api-client';
import type { Profile } from './api-types';

interface TokenResponse {
  readonly accessToken: string;
  readonly expiresIn: number;
}

export interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
  readonly acceptTerms: boolean;
  readonly minimumAgeConfirmed: boolean;
}

interface AuthState {
  readonly status: 'loading' | 'authenticated' | 'anonymous';
  readonly profile: Profile | null;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly register: (input: RegisterInput) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly reloadProfile: () => Promise<void>;
  readonly can: (...permissions: string[]) => boolean;
  readonly hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

async function postAuth(path: string, body?: unknown): Promise<TokenResponse> {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? null : JSON.stringify(body)
  });

  if (!response.ok) {
    throw await parseProblem(response);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Mantém o access token somente em memória. A sessão é restaurada pelo cookie
 * HttpOnly de refresh e renovada antes de expirar.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const schedule = useCallback((expiresIn: number, refreshFn: () => Promise<string | null>) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => void refreshFn(), Math.max(30, expiresIn - 60) * 1000);
  }, []);

  const loadProfile = useCallback(async () => {
    const me = await api<Profile>('/me');

    setProfile(me);
    setStatus('authenticated');
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) {
      return refreshing.current;
    }

    refreshing.current = (async () => {
      try {
        const result = await postAuth('refresh');

        tokenRef.current = result.accessToken;
        schedule(result.expiresIn, refresh);

        return result.accessToken;
      } catch {
        tokenRef.current = null;
        setProfile(null);
        setStatus('anonymous');

        return null;
      } finally {
        refreshing.current = null;
      }
    })();

    return refreshing.current;
  }, [schedule]);

  useEffect(() => {
    setTokenProvider({ getToken: () => tokenRef.current, refresh });

    void (async () => {
      const token = await refresh();

      if (token) {
        try {
          await loadProfile();
        } catch {
          setStatus('anonymous');
        }
      }
    })();

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [refresh, loadProfile]);

  const startSession = useCallback(
    async (result: TokenResponse) => {
      tokenRef.current = result.accessToken;
      schedule(result.expiresIn, refresh);
      await loadProfile();
    },
    [loadProfile, refresh, schedule]
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      profile,
      login: async (email, password) => startSession(await postAuth('login', { email, password })),
      register: async (input) => startSession(await postAuth('register', input)),
      logout: async () => {
        try {
          await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } finally {
          tokenRef.current = null;
          setProfile(null);
          setStatus('anonymous');
        }
      },
      reloadProfile: loadProfile,
      can: (...permissions) =>
        profile !== null &&
        permissions.every((permission) => profile.permissions.includes(permission)),
      hasRole: (role) => profile?.roles.includes(role) ?? false
    }),
    [status, profile, startSession, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
