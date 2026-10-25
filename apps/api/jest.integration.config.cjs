const baseConfig = require('./jest.config.cjs');

/**
 * Testes de integração contra PostgreSQL real, em banco exclusivo `<banco>_test`
 * recriado a cada execução. O banco de desenvolvimento nunca é tocado (DT-038).
 */
module.exports = {
  ...baseConfig,
  displayName: 'api-integration',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/global-setup.cjs',
  setupFiles: [...(baseConfig.setupFiles ?? []), '<rootDir>/test/use-test-database.cjs'],
  testTimeout: 60_000
};
