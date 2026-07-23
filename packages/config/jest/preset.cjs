module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    '<rootDir>/**/*.{ts,tsx}',
    '!<rootDir>/**/*.d.ts',
    '!<rootDir>/**/*.config.{ts,tsx}'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageProvider: 'v8',
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.next/']
};
