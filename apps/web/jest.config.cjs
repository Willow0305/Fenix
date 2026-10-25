const nextJest = require('next/jest.js');
const baseConfig = require('../../jest.preset.cjs');

const createJestConfig = nextJest({
  dir: './'
});

module.exports = createJestConfig({
  ...baseConfig,
  displayName: 'web',
  moduleNameMapper: {
    '^@fenix/ui$': '<rootDir>/../../packages/ui/src/index.ts',
    '^@fenix/validation$': '<rootDir>/../../packages/validation/src/index.ts'
  },
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/**/*.spec.ts?(x)']
});
