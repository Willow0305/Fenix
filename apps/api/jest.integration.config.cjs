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
  testTimeout: 60_000,
  // Uma suíte por vez (--maxWorkers=1, sem disputa no banco) num processo auxiliar que o Jest
  // troca quando passa deste uso de memória: em um processo só (--runInBand), a memória das
  // 50+ suítes se acumulava até estourar o limite do Node (DT-114).
  workerIdleMemoryLimit: '1.5GB'
};
