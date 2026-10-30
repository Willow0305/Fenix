/** Área em pixels da imagem original, como devolvida pelo `react-easy-crop`. */
export interface CropArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Lado maior da imagem cortada: o servidor otimiza para 1920 px, então não vale mandar mais. */
export const MAX_CROP_SIDE = 2400;

/** Tamanho final do corte, reduzido proporcionalmente quando passa do limite. */
export function outputSize(
  area: CropArea,
  maxSide = MAX_CROP_SIDE
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(area.width, area.height));

  return {
    width: Math.max(1, Math.round(area.width * scale)),
    height: Math.max(1, Math.round(area.height * scale))
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem para cortar.'));
    image.src = src;
  });
}

/**
 * Recorta a imagem no próprio navegador e devolve um JPEG pronto para enviar. Nada sai do
 * aparelho antes de a pessoa confirmar; o servidor ainda valida e otimiza o arquivo.
 */
export async function cropToBlob(src: string, area: CropArea): Promise<Blob> {
  const image = await loadImage(src);
  const size = outputSize(area);
  const canvas = document.createElement('canvas');

  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Este navegador não consegue cortar imagens.');
  }

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar o recorte.'))),
      'image/jpeg',
      0.9
    );
  });
}
