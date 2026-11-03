/** @jest-environment node */
import { allowsPhoenixVideo, type MotionEnvironment } from './phoenix-motion';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const capable: MotionEnvironment = {
  reducedMotion: false,
  saveData: false,
  effectiveType: '4g',
  deviceMemory: 8,
  cores: 8,
  userAgent: CHROME
};

describe('fênix animada ou logo parada (DT-098)', () => {
  it('anima em aparelho bom com conexão rápida', () => {
    expect(allowsPhoenixVideo(capable)).toBe(true);
  });

  it('anima quando o navegador não informa conexão nem memória', () => {
    expect(allowsPhoenixVideo({ reducedMotion: false, userAgent: CHROME })).toBe(true);
  });

  it.each(['slow-2g', '2g', '3g'])('fica parada em conexão %s', (effectiveType) => {
    expect(allowsPhoenixVideo({ ...capable, effectiveType })).toBe(false);
  });

  it('fica parada com economia de dados ligada', () => {
    expect(allowsPhoenixVideo({ ...capable, saveData: true })).toBe(false);
  });

  it('fica parada em aparelho com pouca memória ou poucos núcleos', () => {
    expect(allowsPhoenixVideo({ ...capable, deviceMemory: 2 })).toBe(false);
    expect(allowsPhoenixVideo({ ...capable, cores: 2 })).toBe(false);
  });

  it('fica parada para quem pediu menos movimento no sistema', () => {
    expect(allowsPhoenixVideo({ ...capable, reducedMotion: true })).toBe(false);
  });

  it('fica parada no Safari e no iPhone, que mostram o vídeo com fundo preto', () => {
    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    const chromeOnIphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
    const android =
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

    expect(allowsPhoenixVideo({ ...capable, userAgent: safari })).toBe(false);
    expect(allowsPhoenixVideo({ ...capable, userAgent: chromeOnIphone })).toBe(false);
    expect(allowsPhoenixVideo({ ...capable, userAgent: android })).toBe(true);
  });
});
