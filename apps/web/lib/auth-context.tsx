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
  readonly idleTimeoutSeconds: number;
}

/** Eventos que contam como uso real da página (DT-036). */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const IDLE_CHECK_INTERVAL_MS = 30_000;

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
  /** A sessão terminou por inatividade ou tempo limite, sem logout explícito. */
  readonly sessionExpired: boolean;
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
 * HttpOnly de refresh e renovada antes de expirar. A renovação só informa uso real
 * quando houve interação; sem interação pelo limite do perfil, a sessão é descartada
 * localmente e o servidor a recusa pelo mesmo critério (DT-036).
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteraction = useRef(Date.now());
  const activeSinceRefresh = useRef(true);
  const idleLimitSeconds = useRef<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  const endSession = useCallback((expired: boolean) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    tokenRef.current = null;
    idleLimitSeconds.current = null;
    setProfile(null);
    setStatus('anonymous');
    setSessionExpired(expired);
  }, []);

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
      const active = activeSinceRefresh.current;

      try {
        const result = await postAuth('refresh', { active });

        activeSinceRefresh.current = false;
        tokenRef.current = result.accessToken;
        idleLimitSeconds.current = result.idleTimeoutSeconds;
        schedule(result.expiresIn, refresh);

        return result.accessToken;
      } catch {
        endSession(tokenRef.current !== null);

        return null;
      } finally {
        refreshing.current = null;
      }
    })();

    return refreshing.current;
  }, [schedule, endSession]);

  useEffect(() => {
    const markActive = () => {
      lastInteraction.current = Date.now();
      activeSinceRefresh.current = true;
    };
    const checkIdle = () => {
      const limit = idleLimitSeconds.current;

      if (
        tokenRef.current !== null &&
        limit !== null &&
        Date.now() - lastInteraction.current >= limit * 1000
      ) {
        endSession(true);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkIdle();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }

      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [endSession]);

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
      idleLimitSeconds.current = result.idleTimeoutSeconds;
      lastInteraction.current = Date.now();
      activeSinceRefresh.current = false;
      setSessionExpired(false);
      schedule(result.expiresIn, refresh);
      await loadProfile();
    },
    [loadProfile, refresh, schedule]
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      profile,
      sessionExpired,
      login: async (email, password) => startSession(await postAuth('login', { email, password })),
      register: async (input) => startSession(await postAuth('register', input)),
      logout: async () => {
        try {
          await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } finally {
          endSession(false);
        }
      },
      reloadProfile: loadProfile,
      can: (...permissions) =>
        profile !== null &&
        permissions.every((permission) => profile.permissions.includes(permission)),
      hasRole: (role) => profile?.roles.includes(role) ?? false
    }),
    [status, profile, sessionExpired, startSession, loadProfile, endSession]
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
