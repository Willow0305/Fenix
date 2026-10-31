/**
 * Versões menores das imagens públicas pelo otimizador do Next (`/_next/image`, DT-082): o
 * celular baixa uma foto do tamanho em que ela aparece, não a de 1920 px do computador.
 * Só endereços públicos passam por ele (mídia da API e imagens da marca); os demais seguem
 * como estão. Mídia privada nunca chega aqui: o otimizador busca sem o token de acesso, e a
 * API responde 404.
 */

/** Larguras aceitas pelo otimizador (padrão do Next: `imageSizes` + `deviceSizes`). */
export const IMAGE_WIDTHS = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840
] as const;

/** Larguras oferecidas para fotos que acompanham a largura da tela. */
const RESPONSIVE_WIDTHS = [384, 640, 828, 1200, 1920] as const;

export function canOptimize(src: string | null | undefined): src is string {
  return Boolean(src && (src.startsWith('/api/v1/media/') || src.startsWith('/brand/')));
}

/** Endereço da versão com pelo menos `width` px de largura (ou o original, se não der). */
export function optimizedUrl(src: string, width: number): string {
  if (!canOptimize(src)) {
    return src;
  }

  const allowed = IMAGE_WIDTHS.find((value) => value >= width) ?? 3840;

  return `/_next/image?url=${encodeURIComponent(src)}&w=${allowed}&q=75`;
}

/** Imagem de tamanho fixo (logo, foto de perfil): versões 1x e 2x. */
export function fixedSrcSet(src: string | null | undefined, size: number): string | undefined {
  if (!canOptimize(src)) {
    return undefined;
  }

  return `${optimizedUrl(src, size)} 1x, ${optimizedUrl(src, size * 2)} 2x`;
}

/** Foto que acompanha a largura da tela; use junto com `sizes`. */
export function responsiveSrcSet(src: string | null | undefined): string | undefined {
  if (!canOptimize(src)) {
    return undefined;
  }

  return RESPONSIVE_WIDTHS.map((width) => `${optimizedUrl(src, width)} ${width}w`).join(', ');
}
