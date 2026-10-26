import { technicalHealthSchema } from './health';

describe('technicalHealthSchema', () => {
  it('accepts the public technical health contract', () => {
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

  it('rejects configuration details outside the contract', () => {
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
