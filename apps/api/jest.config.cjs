const baseConfig = require('../../jest.preset.cjs');

module.exports = {
  ...baseConfig,
  displayName: 'api',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  // Testes usam o código-fonte do pacote compartilhado, sem depender do build (DT-040).
  moduleNameMapper: {
    '^@fenix/validation$': '<rootDir>/../../packages/validation/src/index.ts'
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json'
      }
    ]
  }
};
