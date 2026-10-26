/** Navegador lembrado na segunda etapa (DT-050). */
export const TRUSTED_DEVICE_DAYS = 30;

/** Mais que isso, os mais antigos são esquecidos ao lembrar um novo. */
export const MAX_TRUSTED_DEVICES = 10;

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari']
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iPhone/iPad'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/CrOS/, 'Chromebook'],
  [/Linux/, 'Linux']
];

/** Nome para a pessoa reconhecer o aparelho, sem guardar o identificador completo. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const agent = userAgent ?? '';
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];

  if (browser && system) {
    return `${browser} no ${system}`;
  }

  return browser ?? system ?? 'Navegador desconhecido';
}

export function trustedDeviceExpiry(now: Date): Date {
  return new Date(now.getTime() + TRUSTED_DEVICE_DAYS * 86_400_000);
}
