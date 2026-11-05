import { defineConfig } from 'vitest/config';
import { alias, testEnv } from './vitest.shared';

/**
 * Cobertura: roda unitários, integração e e2e juntos (`npm run test:cov`). A camada de
 * infraestrutura e os controllers só são exercitados pelos testes com banco, então a
 * cobertura total precisa somar os três níveis. Requer o Postgres de pé.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['test/support/global-setup.ts'],
    env: testEnv,
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: [
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'test/integration/**/*.int-spec.ts',
      'test/**/*.e2e-spec.ts',
    ],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/**/*.tokens.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/main.ts',
        'src/shared/testing/**',
        'src/**/ports/**',
        'src/**/*.dto.ts',
      ],
      thresholds: {
        'src/modules/**/domain/**': { lines: 95, branches: 95 },
        'src/modules/**/application/**': { lines: 85 },
        lines: 80,
      },
    },
  },
  resolve: { alias },
});
