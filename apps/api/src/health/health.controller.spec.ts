import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('devolve uma resposta técnica mínima de saúde', () => {
    const response = new HealthController().getHealth();

    expect(response).toMatchObject({
      service: 'fenix-api',
      status: 'ok'
    });
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });
});
