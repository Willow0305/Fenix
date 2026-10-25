import sharp from 'sharp';

/** Dimensões máximas da imagem otimizada; a proporção original é mantida. */
export interface ImageOptimization {
  readonly maxWidth: number;
  readonly maxHeight: number;
}

export interface OptimizedImage {
  readonly buffer: Buffer;
  readonly width: number;
  readonly height: number;
}

/** Limite de pixels decodificados (≈ 50 MP): barra "bombas de descompressão". */
const MAX_INPUT_PIXELS = 50_000_000;
const WEBP_QUALITY = 82;

export class ImageDecodeError extends Error {}

/**
 * Otimiza imagem pública (DT-039): decodifica o arquivo inteiro (detecta imagem corrompida
 * ou truncada), corrige a rotação da câmera, reduz até o limite sem ampliar e converte para
 * WebP. Metadados (EXIF, GPS, perfil da câmera) são descartados.
 */
export async function optimizeImage(
  input: Buffer,
  options: ImageOptimization
): Promise<OptimizedImage> {
  try {
    const { data, info } = await sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS
    })
      .rotate()
      .resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw new ImageDecodeError('Imagem corrompida, incompleta ou grande demais para processar.');
  }
}
