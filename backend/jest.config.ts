import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/swagger.ts',
    '!src/config/index.ts',
  ],
  coverageThreshold: { global: { lines: 60 } },
  testTimeout: 30000,
  verbose: true,
};

export default config;
