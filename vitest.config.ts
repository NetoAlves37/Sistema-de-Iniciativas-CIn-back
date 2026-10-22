import { defineConfig } from 'vitest/config';
import { alias } from './vitest.shared';

/** Testes unitários, de aplicação e de arquitetura (sem banco). */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '**/*.int-spec.ts'],
    root: '.',
  },
  resolve: { alias },
});
