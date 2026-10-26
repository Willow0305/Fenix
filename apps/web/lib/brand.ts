import type { BrandContext, PublicTeam } from './api-types';

export interface BrandAsset {
  readonly url: string;
  readonly altText: string | null;
}

/**
 * Logo enviado em Configurações → Marca para o contexto pedido, com o brasão oficial como
 * reserva (sem nenhum dos dois, o `BrandLogo` usa o brasão do repositório).
 */
export function brandAsset(
  assets: PublicTeam['brandAssets'],
  context: BrandContext
): BrandAsset | undefined {
  return assets[context] ?? assets.OFFICIAL;
}

/** Logo de cada tipo de time: masculino e feminino têm o próprio; os demais, o oficial. */
export function teamTypeContext(type: string): BrandContext {
  return type === 'MALE' || type === 'FEMALE' ? type : 'OFFICIAL';
}
