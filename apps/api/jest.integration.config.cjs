const baseConfig = require('./jest.config.cjs');

/** Testes de integração contra PostgreSQL real (DATABASE_URL). */
module.exports = {
  ...baseConfig,
  displayName: 'api-integration',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  testTimeout: 60_000
};
