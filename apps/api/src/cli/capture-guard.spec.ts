import { assertLocalOnly } from './capture-guard';

describe('conta de capturas: só no ambiente local', () => {
  it('aceita localhost e 127.0.0.1 fora de produção', () => {
    expect(() => assertLocalOnly({ WEB_ORIGIN: 'http://localhost:3000' })).not.toThrow();
    expect(() => assertLocalOnly({ WEB_ORIGIN: 'http://127.0.0.1:3000' })).not.toThrow();
    expect(() => assertLocalOnly({})).not.toThrow();
  });

  it('recusa produção, mesmo com endereço local', () => {
    expect(() =>
      assertLocalOnly({ NODE_ENV: 'production', WEB_ORIGIN: 'http://localhost:3000' })
    ).toThrow('ambiente local');
  });

  it('recusa endereço público', () => {
    expect(() => assertLocalOnly({ WEB_ORIGIN: 'https://fenixvolei.com.br' })).toThrow(
      'ambiente local'
    );
  });
});
