/**
 * Fênix animada (DT-098): vídeos com fundo transparente em `public/brand/animacoes/`. Em
 * conexão lenta, aparelho fraco, movimento reduzido ou navegador sem vídeo transparente,
 * fica a logo parada sem fundo.
 */
export const PHOENIX_LOOP_SRC = '/brand/animacoes/tela-inicial/fenix-loop.webm';

export interface MotionEnvironment {
  readonly reducedMotion: boolean;
  readonly saveData?: boolean | undefined;
  /** `navigator.connection.effectiveType`: slow-2g, 2g, 3g ou 4g. */
  readonly effectiveType?: string | undefined;
  /** `navigator.deviceMemory`, em GB (o navegador arredonda: 0.25 a 8). */
  readonly deviceMemory?: number | undefined;
  readonly cores?: number | undefined;
  readonly userAgent: string;
}

const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

/**
 * Safari e qualquer navegador do iPhone/iPad (todos usam o motor do Safari) mostram o WebM
 * sem a transparência, com fundo preto; neles fica a logo parada.
 */
function lacksTransparentWebm(userAgent: string): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return true;
  }

  return /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|Firefox|Android/.test(userAgent);
}

/** Decide se a fênix pode ser o vídeo; sem informação do navegador, conta como capaz. */
export function allowsPhoenixVideo(env: MotionEnvironment): boolean {
  if (env.reducedMotion || env.saveData === true) {
    return false;
  }

  if (env.effectiveType !== undefined && SLOW_CONNECTIONS.has(env.effectiveType)) {
    return false;
  }

  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) {
    return false;
  }

  if (env.cores !== undefined && env.cores <= 2) {
    return false;
  }

  return !lacksTransparentWebm(env.userAgent);
}

interface NavigatorHints {
  readonly connection?: { readonly saveData?: boolean; readonly effectiveType?: string };
  readonly deviceMemory?: number;
}

/** Lê o ambiente do navegador; só roda no cliente. */
export function readMotionEnvironment(): MotionEnvironment {
  const hints = navigator as Navigator & NavigatorHints;

  return {
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: hints.connection?.saveData,
    effectiveType: hints.connection?.effectiveType,
    deviceMemory: hints.deviceMemory,
    cores: navigator.hardwareConcurrency || undefined,
    userAgent: navigator.userAgent
  };
}
