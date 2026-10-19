import type { PublicTeam } from './api-types';

const API_INTERNAL_URL = process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3333';

/**
 * Leitura de conteúdo público no servidor (Server Components). Falhas retornam `null`
 * para que a página exiba estado institucional em vez de erro.
 */
export async function serverGet<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  try {
    const response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
      next: { revalidate: revalidateSeconds },
      headers: { Accept: 'application/json' }
    });

    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export const FALLBACK_TEAM: PublicTeam = {
  teamName: 'Fênix Vôlei',
  officialName: 'Time Fênix Volleyball',
  description: 'Time de vôlei que renasce a cada jogo.',
  history: null,
  email: null,
  phone: null,
  socialLinks: [],
  address: { line1: null, line2: null, city: null, state: null, postalCode: null, country: null },
  primaryColor: '#CD151D',
  secondaryColor: '#0B0613',
  currency: 'BRL',
  timeZone: 'America/Rio_Branco',
  termsOfUse: null,
  privacyPolicy: null,
  monthlyFeeRules: null,
  storeRules: null,
  pickupInstructions: null,
  brandAssets: {}
};

export async function getPublicTeam(): Promise<PublicTeam> {
  return (await serverGet<PublicTeam>('/public/team')) ?? FALLBACK_TEAM;
}
