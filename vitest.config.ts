import { defineConfig } from 'vitest/config';
import { alias } from './vitest.shared';

/** Testes unitários, de aplicação e de arquitetura (sem banco). */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', '**/*.int-spec.ts'],
    root: '.',
    coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
  reportOnFailure: true,
  include: [
    'src/modules/iniciativas/domain/**/*.ts',
    'src/modules/iniciativas/application/**/*.ts',
    'src/modules/divulgacao/domain/**/*.ts',
    'src/modules/divulgacao/application/**/*.ts',
    'src/modules/refinamento/domain/**/*.ts',
    'src/modules/refinamento/application/**/*.ts',
  ],
  exclude: [
    'src/**/*.spec.ts',
    'src/**/*.test.ts',
    '**/ports/**',
    '**/*.port.ts',
    '**/*.dto.ts',
  ],
},
  },
  resolve: { alias },
});