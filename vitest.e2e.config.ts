import { defineConfig } from 'vitest/config';
import { alias, testEnv } from './vitest.shared';

/** Testes e2e: aplicação real (mesmo `configureApp` do main.ts) + Postgres real + token de teste. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    exclude: ['node_modules', 'dist'],
    globalSetup: ['test/support/global-setup.ts'],
    env: testEnv,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: { alias },
});
