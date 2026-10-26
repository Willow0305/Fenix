import { technicalHealthSchema } from './health';

describe('technicalHealthSchema', () => {
  it('aceita o contrato público de saúde', () => {
    expect(
      technicalHealthSchema.parse({
        service: 'fenix-api',
        status: 'ok',
        timestamp: '2026-07-23T18:00:00.000Z'
      })
    ).toEqual({
      service: 'fenix-api',
      status: 'ok',
      timestamp: '2026-07-23T18:00:00.000Z'
    });
  });

  it('recusa detalhes de configuração fora do contrato', () => {
    expect(() =>
      technicalHealthSchema.parse({
        database: 'internal-host',
        service: 'fenix-api',
        status: 'ok',
        timestamp: '2026-07-23T18:00:00.000Z'
      })
    ).toThrow();
  });
});
