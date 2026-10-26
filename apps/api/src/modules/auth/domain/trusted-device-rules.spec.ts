import { deviceLabel, trustedDeviceExpiry } from './trusted-device-rules';

describe('navegador lembrado', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      'Chrome no Windows'
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
      'Edge no Windows'
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
      'Chrome no Android'
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari no iPhone/iPad'
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Firefox no Mac'
    ],
    [null, 'Navegador desconhecido']
  ])('reconhece %p', (agent, label) => {
    expect(deviceLabel(agent)).toBe(label);
  });

  it('vale 30 dias', () => {
    expect(trustedDeviceExpiry(new Date('2026-10-26T12:00:00Z')).toISOString()).toBe(
      '2026-11-25T12:00:00.000Z'
    );
  });
});
