import sharp from 'sharp';

import { ImageDecodeError, optimizeImage } from './image-processing';

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 205, g: 21, b: 29 } }
  })
    .png()
    .toBuffer();
}

describe('optimizeImage', () => {
  it('converte para WebP e reduz mantendo a proporção', async () => {
    const result = await optimizeImage(await png(4000, 2000), { maxWidth: 1920, maxHeight: 1920 });
    const meta = await sharp(result.buffer).metadata();

    expect(meta.format).toBe('webp');
    expect(result.width).toBe(1920);
    expect(result.height).toBe(960);
  });

  it('não amplia imagens pequenas', async () => {
    const result = await optimizeImage(await png(300, 200), { maxWidth: 1920, maxHeight: 1920 });

    expect([result.width, result.height]).toEqual([300, 200]);
  });

  it('descarta metadados da câmera (EXIF/GPS)', async () => {
    const withExif = await sharp(await png(50, 50))
      .withExif({ IFD0: { Copyright: 'teste' } })
      .jpeg()
      .toBuffer();
    const result = await optimizeImage(withExif, { maxWidth: 100, maxHeight: 100 });

    expect((await sharp(result.buffer).metadata()).exif).toBeUndefined();
  });

  it('recusa imagem corrompida ou truncada', async () => {
    const valid = await png(200, 200);

    await expect(
      optimizeImage(valid.subarray(0, valid.length / 2), { maxWidth: 100, maxHeight: 100 })
    ).rejects.toBeInstanceOf(ImageDecodeError);
    await expect(
      optimizeImage(Buffer.from('não é imagem'), { maxWidth: 100, maxHeight: 100 })
    ).rejects.toBeInstanceOf(ImageDecodeError);
  });
});
