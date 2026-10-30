import { devTrustedOrigins, trustedOriginsFor } from './app-config';

describe('origens aceitas (CSRF e CORS)', () => {
  it('em desenvolvimento aceita o site pelo IP de rede e as origens extras', () => {
    expect(
      devTrustedOrigins('http://localhost:3000', { DEV_ALLOWED_ORIGINS: 'meu-pc.local, ' }, [
        '192.168.1.8'
      ])
    ).toEqual(['http://localhost:3000', 'http://192.168.1.8:3000', 'http://meu-pc.local:3000']);
  });

  it('em produção aceita só o endereço oficial do site, mesmo com origens extras', () => {
    expect(
      trustedOriginsFor(true, 'https://fenixvolei.com.br', { DEV_ALLOWED_ORIGINS: '192.168.1.8' }, [
        '192.168.1.8'
      ])
    ).toEqual(['https://fenixvolei.com.br']);
  });
});
