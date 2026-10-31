/** @jest-environment node */
import { canOptimize, fixedSrcSet, optimizedUrl, responsiveSrcSet } from './image-url';

const MEDIA = '/api/v1/media/6a0de5e0-3368-48f9-a8c2-177bf8976a0c';

describe('versões menores das imagens', () => {
  it('só otimiza mídia pública da API e imagens da marca', () => {
    expect(canOptimize(MEDIA)).toBe(true);
    expect(canOptimize('/brand/logo-fenix.png')).toBe(true);
    expect(canOptimize('blob:http://localhost/123')).toBe(false);
    expect(canOptimize('https://exemplo.test/foto.jpg')).toBe(false);
    expect(canOptimize(null)).toBe(false);
    expect(optimizedUrl('https://exemplo.test/foto.jpg', 640)).toBe(
      'https://exemplo.test/foto.jpg'
    );
  });

  it('arredonda para cima até uma largura aceita pelo otimizador', () => {
    expect(optimizedUrl(MEDIA, 40)).toBe(`/_next/image?url=${encodeURIComponent(MEDIA)}&w=48&q=75`);
    expect(optimizedUrl(MEDIA, 5000)).toContain('&w=3840&');
  });

  it('logo de tamanho fixo ganha versões 1x e 2x', () => {
    expect(fixedSrcSet(MEDIA, 64)).toBe(
      `${optimizedUrl(MEDIA, 64)} 1x, ${optimizedUrl(MEDIA, 128)} 2x`
    );
    expect(fixedSrcSet(undefined, 64)).toBeUndefined();
  });

  it('foto que acompanha a tela oferece da menor à maior largura', () => {
    const widths = responsiveSrcSet(MEDIA)
      ?.split(', ')
      .map((entry) => entry.split(' ')[1]);

    expect(widths).toEqual(['384w', '640w', '828w', '1200w', '1920w']);
    expect(responsiveSrcSet('blob:x')).toBeUndefined();
  });
});
