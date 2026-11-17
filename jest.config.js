/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Tests sit beside the file they test, as `<name>.test.ts(x)`. Never under
  // `app/`: expo-router turns every file there into a route.
  testMatch: ['<rootDir>/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/app/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
