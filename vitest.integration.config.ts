import { defineConfig } from 'vitest/config';
import { alias, testEnv } from './vitest.shared';

/** Testes de integração: repositórios, concorrência e SQL contra um Postgres real. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.int-spec.ts'],
    exclude: ['node_modules', 'dist'],
    globalSetup: ['test/support/global-setup.ts'],
    env: testEnv,
    // Todos compartilham o mesmo banco de testes.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: { alias },
});
