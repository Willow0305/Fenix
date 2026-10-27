import type { BrandContext, PublicTeam } from './api-types';

export interface BrandAsset {
  readonly url: string;
  readonly altText: string | null;
}

/**
 * Imagem enviada em Configurações → Marca para o contexto pedido, com o brasão oficial
 * como reserva (sem nenhum dos dois, o `BrandLogo` usa o brasão do repositório).
 */
export function brandAsset(
  assets: PublicTeam['brandAssets'],
  context: BrandContext
): BrandAsset | undefined {
  return assets[context] ?? assets.OFFICIAL;
}

/** Logo da primeira equipe do tipo que tenha logo própria (cartões do Início, filtro de Times). */
export function firstTeamLogo(
  teams: readonly { type: string; logoUrl: string | null }[],
  type: string
): string | undefined {
  return teams.find((team) => team.type === type && team.logoUrl)?.logoUrl ?? undefined;
}
