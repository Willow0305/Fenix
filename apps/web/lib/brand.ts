import type { BrandContext, PublicTeam } from './api-types';

/**
 * Imagens da marca salvas em `public/brand/` (ver docs/COMO-EXECUTAR.md). Ficam aqui, fora
 * de componente de cliente, para páginas de servidor também poderem usar o caminho.
 */
export const BRASAO_SRC = '/brand/brasao-fenix.png';
/** Símbolo da fênix usado se o brasão ainda não foi adicionado. */
export const SYMBOL_SRC = '/brand/logo-fenix.png';

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

/** Foto da primeira equipe do tipo que tenha foto (cartões do Início, DT-081). */
export function firstTeamPhoto(
  teams: readonly { type: string; photoUrl?: string | null }[],
  type: string
): string | undefined {
  return teams.find((team) => team.type === type && team.photoUrl)?.photoUrl ?? undefined;
}
